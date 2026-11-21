// SPEC: docs/features/content-management — the owner edits description, policy and contact in Arabic and English; anyone reads them; staff cannot change content; every change is audited
// ROADMAP: phase-5-public-site / content-management / Implement site content API: description, policy, contact in Arabic and English
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Caller } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { listAudit } from "@/audit/audit";
import { staffUser } from "@/db/schema";
import { aStaffUser } from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

import {
  contentField,
  createContentOperations,
  readContent,
  type SiteTexts,
} from "./content";

const handle = openTestDb();
const { db } = handle;
const ops = createContentOperations(() => ({ db }));

beforeEach(() => resetDatabase(handle));
afterAll(() => handle.pool.end());

const ctx = (caller: Caller) => createCallContext(caller, { requestId: "r" });
const anon: Caller = { kind: "anonymous" };

async function makeOwner(): Promise<Caller> {
  const row = aStaffUser({ role: "owner" });
  await db.insert(staffUser).values(row);
  return { kind: "staff", userId: row.id, role: "owner" };
}

const entries = [
  { key: "description" as const, valueAr: "قاعة وصال", valueEn: "Wesal hall" },
  {
    key: "policy" as const,
    valueAr: "ادفع العربون",
    valueEn: "Pay the deposit",
  },
  { key: "contact_phone" as const, valueAr: "01012345678", valueEn: "" },
  { key: "contact_whatsapp" as const, valueAr: "01098765432", valueEn: "" },
];

describe("content.read", () => {
  it("returns empty text before the owner writes anything", async () => {
    const result = await ops.read({}, ctx(anon));
    expect(result.ok && result.data.content).toEqual({
      descriptionAr: "",
      descriptionEn: "",
      policyAr: "",
      policyEn: "",
      contactPhone: "",
      contactWhatsapp: "",
    });
  });
});

describe("staff.content.update", () => {
  it("stores all keys in both languages and audits the change", async () => {
    const owner = await makeOwner();
    const result = await ops.update({ entries }, ctx(owner));
    expect(result.ok && result.data.content).toEqual({
      descriptionAr: "قاعة وصال",
      descriptionEn: "Wesal hall",
      policyAr: "ادفع العربون",
      policyEn: "Pay the deposit",
      contactPhone: "01012345678",
      contactWhatsapp: "01098765432",
    });

    const [entry] = await listAudit(db, { limit: 1 });
    expect(entry).toMatchObject({
      action: "content.update",
      target: "content:site",
      detail: {
        description: {
          from: { ar: "", en: "" },
          to: { ar: "قاعة وصال", en: "Wesal hall" },
        },
      },
    });

    const publicRead = await ops.read({}, ctx(anon));
    expect(publicRead.ok && publicRead.data.content.descriptionEn).toBe(
      "Wesal hall",
    );
  });

  it("updates one key without disturbing the others", async () => {
    const owner = await makeOwner();
    await ops.update({ entries }, ctx(owner));
    const result = await ops.update(
      {
        entries: [
          { key: "policy", valueAr: "سياسة جديدة", valueEn: "New policy" },
        ],
      },
      ctx(owner),
    );
    expect(result.ok && result.data.content).toMatchObject({
      descriptionAr: "قاعة وصال",
      policyAr: "سياسة جديدة",
      policyEn: "New policy",
    });
  });

  it("treats blank text as clearing a value", async () => {
    const owner = await makeOwner();
    await ops.update({ entries }, ctx(owner));
    const result = await ops.update(
      { entries: [{ key: "description", valueAr: "  ", valueEn: "" }] },
      ctx(owner),
    );
    expect(result.ok && result.data.content.descriptionAr).toBe("");
    expect(result.ok && result.data.content.descriptionEn).toBe("");
  });

  it("writes no audit row when nothing actually changes", async () => {
    const owner = await makeOwner();
    await ops.update({ entries }, ctx(owner));
    await ops.update({ entries }, ctx(owner));
    expect(await listAudit(db, { limit: 10 })).toHaveLength(1);
  });

  it("rejects a duplicate key, an unknown key and text past its limit", async () => {
    const owner = await makeOwner();
    const attempts = [
      { entries: [entries[0]!, entries[0]!] },
      { entries: [{ key: "tagline", valueAr: "x", valueEn: "x" }] },
      {
        entries: [
          {
            key: "contact_phone",
            valueAr: "1".repeat(31),
            valueEn: "",
          },
        ],
      },
    ];
    for (const input of attempts) {
      const result = await ops.update(input, ctx(owner));
      expect(!result.ok && result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("refuses staff and anonymous callers", async () => {
    const staff: Caller = { kind: "staff", userId: "s", role: "staff" };
    for (const result of [
      await ops.staffGet({}, ctx(staff)),
      await ops.update({ entries }, ctx(staff)),
      await ops.staffGet({}, ctx(anon)),
      await ops.update({ entries }, ctx(anon)),
    ]) {
      expect(!result.ok && result.error.code).toMatch(
        /^(FORBIDDEN|UNAUTHENTICATED)$/,
      );
    }
  });
});

describe("contentField", () => {
  it("reads the stored field for either language", () => {
    const texts: SiteTexts = {
      descriptionAr: "أ",
      descriptionEn: "A",
      policyAr: "سياسة",
      policyEn: "policy",
      contactPhone: "010",
      contactWhatsapp: "011",
    };
    expect(contentField(texts, "description", "ar")).toBe("أ");
    expect(contentField(texts, "description", "en")).toBe("A");
    expect(contentField(texts, "contact_phone", "en")).toBe("010");
  });
});

describe("readContent", () => {
  it("falls back to an English contact number when the Arabic one is empty", async () => {
    // A row written before the editor existed, or by a future client.
    await db.execute(
      sql`insert into site_content (key, value_ar, value_en) values ('contact_whatsapp', '', '01000000000')`,
    );
    expect((await readContent(db)).contactWhatsapp).toBe("01000000000");
  });
});
