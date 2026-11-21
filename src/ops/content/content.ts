import { sql } from "drizzle-orm";
import { z } from "zod";

import { recordAudit } from "@/audit/audit";
import type { Caller } from "@/api/caller";
import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { siteContent } from "@/db/schema";

// Site content operations (docs/features/content-management): the owner-editable
// description, policy and contact details, each in Arabic and English. Anyone
// may read the text; only the owner may change it. The fixed key registry is
// deliberate: the landing page asks for these keys by name, so a typo in the
// dashboard can never silently create a new, unused row.

export const CONTENT_KEYS = [
  "description",
  "policy",
  "contact_phone",
  "contact_whatsapp",
] as const;

export type ContentKey = (typeof CONTENT_KEYS)[number];

/** The longest accepted value per key. A limit, not a suggestion. */
export const CONTENT_LIMITS: Record<ContentKey, number> = {
  description: 5_000,
  policy: 5_000,
  contact_phone: 30,
  contact_whatsapp: 30,
};

/**
 * The flat shape the public site and the editor consume. Description and policy
 * are translated; the two contact numbers are not — a phone number reads the
 * same in both languages — so they have one value each.
 */
export interface SiteTexts {
  descriptionAr: string;
  descriptionEn: string;
  policyAr: string;
  policyEn: string;
  contactPhone: string;
  contactWhatsapp: string;
}

export interface ContentDeps {
  db: Database;
}

type Executor = Pick<Database, "select" | "insert">;

const EMPTY: SiteTexts = {
  descriptionAr: "",
  descriptionEn: "",
  policyAr: "",
  policyEn: "",
  contactPhone: "",
  contactWhatsapp: "",
};

/** Reads every content row into the flat shape the site consumes. */
export async function readContent(db: Executor): Promise<SiteTexts> {
  const rows = await db.select().from(siteContent);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const arabic = (key: ContentKey) => byKey.get(key)?.valueAr.trim() ?? "";
  const english = (key: ContentKey) => byKey.get(key)?.valueEn.trim() ?? "";
  return {
    ...EMPTY,
    descriptionAr: arabic("description"),
    descriptionEn: english("description"),
    policyAr: arabic("policy"),
    policyEn: english("policy"),
    contactPhone: arabic("contact_phone") || english("contact_phone"),
    contactWhatsapp: arabic("contact_whatsapp") || english("contact_whatsapp"),
  };
}

/** The value stored for one key in one language, as the editor sees it. */
export function contentField(
  texts: SiteTexts,
  key: ContentKey,
  locale: "ar" | "en",
): string {
  switch (key) {
    case "description":
      return locale === "ar" ? texts.descriptionAr : texts.descriptionEn;
    case "policy":
      return locale === "ar" ? texts.policyAr : texts.policyEn;
    case "contact_phone":
      return texts.contactPhone;
    case "contact_whatsapp":
      return texts.contactWhatsapp;
  }
}

function actorId(caller: Caller): string {
  if (caller.kind !== "staff") throw new ApiError("UNAUTHENTICATED");
  return caller.userId;
}

const entry = z
  .object({
    key: z.enum(CONTENT_KEYS),
    valueAr: z.string().trim().max(5_000),
    valueEn: z.string().trim().max(5_000),
  })
  .superRefine((value, ctx) => {
    const limit = CONTENT_LIMITS[value.key];
    if (value.valueAr.length > limit) {
      ctx.addIssue({
        code: "too_big",
        maximum: limit,
        inclusive: true,
        origin: "string",
        path: ["valueAr"],
        message: `At most ${limit} characters.`,
      });
    }
    if (value.valueEn.length > limit) {
      ctx.addIssue({
        code: "too_big",
        maximum: limit,
        inclusive: true,
        origin: "string",
        path: ["valueEn"],
        message: `At most ${limit} characters.`,
      });
    }
  });

const entriesInput = z
  .array(entry)
  .min(1)
  .max(CONTENT_KEYS.length)
  .superRefine((entries, ctx) => {
    const seen = new Set<string>();
    for (const [index, value] of entries.entries()) {
      if (seen.has(value.key)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "key"],
          message: "A key may appear only once.",
        });
      }
      seen.add(value.key);
    }
  });

/** Puts the entries in registry order so the audit detail reads predictably. */
function sortEntries(
  entries: z.output<typeof entriesInput>,
): z.output<typeof entriesInput> {
  const order = new Map(CONTENT_KEYS.map((key, index) => [key, index]));
  return [...entries].sort(
    (a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0),
  );
}

export function createContentOperations(resolve: () => ContentDeps) {
  const read = defineOperation({
    name: "content.read",
    access: "anonymous",
    input: z.object({}),
    handler: async () => ({
      content: await readContent(resolve().db),
    }),
  });

  // The editor reads the same text through an owner-only operation, so the
  // dashboard never relies on the public endpoint for its own data.
  const staffGet = defineOperation({
    name: "staff.content.get",
    access: "owner",
    input: z.object({}),
    handler: async () => ({
      content: await readContent(resolve().db),
    }),
  });

  const update = defineOperation({
    name: "staff.content.update",
    access: "owner",
    input: z.object({ entries: entriesInput }),
    handler: async ({ entries }, ctx) => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      const ordered = sortEntries(entries);
      return db.transaction(async (tx) => {
        const before = await readContent(tx);
        const now = ctx.clock.now();
        const detail: Record<string, unknown> = {};

        for (const value of ordered) {
          const isContact =
            value.key === "contact_phone" || value.key === "contact_whatsapp";
          const previousAr = contentField(before, value.key, "ar");
          const previousEn = contentField(before, value.key, "en");
          // A contact number is one value in both languages, so the editor's
          // Arabic field is the source for both columns.
          const nextAr = value.valueAr;
          const nextEn = isContact ? value.valueAr : value.valueEn;

          if (previousAr === nextAr && previousEn === nextEn) continue;

          detail[value.key] = {
            from: { ar: previousAr, en: previousEn },
            to: { ar: nextAr, en: nextEn },
          };

          await tx
            .insert(siteContent)
            .values({
              key: value.key,
              valueAr: nextAr,
              valueEn: nextEn,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: siteContent.key,
              set: {
                valueAr: sql`excluded.value_ar`,
                valueEn: sql`excluded.value_en`,
                updatedAt: now,
              },
            });
        }

        if (Object.keys(detail).length > 0) {
          await recordAudit(tx, ctx.clock, {
            actorId: actor,
            action: "content.update",
            target: "content:site",
            detail,
          });
        }

        return { content: await readContent(tx) };
      });
    },
  });

  return { read, staffGet, update };
}

export const contentOperations = createContentOperations(() => ({
  db: getDb(),
}));
