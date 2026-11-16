import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { recordAudit } from "@/audit/audit";
import type { Caller } from "@/api/caller";
import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { occasion } from "@/db/schema";

// Occasion operations (docs/features/venue-settings). Anyone can read the active
// list with prices; only the owner maintains it. Occasions are never deleted,
// only deactivated, so past bookings keep their occasion.

export interface OccasionDeps {
  db: Database;
}

const publicColumns = {
  id: occasion.id,
  nameAr: occasion.nameAr,
  nameEn: occasion.nameEn,
  priceEgp: occasion.priceEgp,
  position: occasion.position,
};

const staffColumns = { ...publicColumns, active: occasion.active };

const name = z.string().trim().min(1).max(100);
const price = z.number().int().min(0).max(10_000_000);
const position = z.number().int().min(0).max(10_000);

function actorId(caller: Caller): string {
  if (caller.kind !== "staff") throw new ApiError("UNAUTHENTICATED");
  return caller.userId;
}

export function createOccasionOperations(resolve: () => OccasionDeps) {
  const listPublic = defineOperation({
    name: "occasions.list",
    access: "anonymous",
    input: z.object({}),
    handler: async () => ({
      occasions: await resolve()
        .db.select(publicColumns)
        .from(occasion)
        .where(eq(occasion.active, true))
        .orderBy(asc(occasion.position), asc(occasion.id)),
    }),
  });

  const listStaff = defineOperation({
    name: "staff.occasions.list",
    access: "owner",
    input: z.object({}),
    handler: async () => ({
      occasions: await resolve()
        .db.select(staffColumns)
        .from(occasion)
        .orderBy(asc(occasion.position), asc(occasion.id)),
    }),
  });

  const create = defineOperation({
    name: "staff.occasions.create",
    access: "owner",
    input: z.object({
      nameAr: name,
      nameEn: name,
      priceEgp: price,
      /** Defaults to the end of the list. */
      position: position.optional(),
    }),
    handler: async (input, ctx) => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      return db.transaction(async (tx) => {
        let pos = input.position;
        if (pos === undefined) {
          const [row] = await tx
            .select({
              next: sql<number>`coalesce(max(${occasion.position}), -1) + 1`,
            })
            .from(occasion);
          pos = Number(row?.next ?? 0);
        }
        const now = ctx.clock.now();
        const [created] = await tx
          .insert(occasion)
          .values({
            nameAr: input.nameAr,
            nameEn: input.nameEn,
            priceEgp: input.priceEgp,
            position: pos,
            createdAt: now,
            updatedAt: now,
          })
          .returning(staffColumns);
        if (!created) throw new ApiError("INTERNAL");
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: "occasion.create",
          target: `occasion:${created.id}`,
          detail: {
            nameAr: created.nameAr,
            nameEn: created.nameEn,
            priceEgp: created.priceEgp,
          },
        });
        return created;
      });
    },
  });

  const update = defineOperation({
    name: "staff.occasions.update",
    access: "owner",
    input: z
      .object({
        id: z.coerce.number().int().positive(),
        nameAr: name.optional(),
        nameEn: name.optional(),
        priceEgp: price.optional(),
        active: z.boolean().optional(),
        position: position.optional(),
      })
      .refine(
        (v) =>
          v.nameAr !== undefined ||
          v.nameEn !== undefined ||
          v.priceEgp !== undefined ||
          v.active !== undefined ||
          v.position !== undefined,
        { message: "Nothing to change." },
      ),
    handler: async (input, ctx) => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(occasion)
          .where(eq(occasion.id, input.id))
          .for("update");
        if (!current) throw new ApiError("NOT_FOUND", "No such occasion.");

        const changes: Partial<typeof occasion.$inferInsert> = {};
        const detail: Record<string, unknown> = {};
        for (const key of [
          "nameAr",
          "nameEn",
          "priceEgp",
          "active",
          "position",
        ] as const) {
          const next = input[key];
          if (next !== undefined && next !== current[key]) {
            (changes as Record<string, unknown>)[key] = next;
            detail[key] = { from: current[key], to: next };
          }
        }

        if (Object.keys(changes).length > 0) {
          await tx
            .update(occasion)
            .set({ ...changes, updatedAt: ctx.clock.now() })
            .where(eq(occasion.id, current.id));
          await recordAudit(tx, ctx.clock, {
            actorId: actor,
            action: "occasion.update",
            target: `occasion:${current.id}`,
            detail,
          });
        }

        const [updated] = await tx
          .select(staffColumns)
          .from(occasion)
          .where(eq(occasion.id, current.id));
        if (!updated) throw new ApiError("NOT_FOUND");
        return updated;
      });
    },
  });

  return { listPublic, listStaff, create, update };
}

export const occasionOperations = createOccasionOperations(() => ({
  db: getDb(),
}));
