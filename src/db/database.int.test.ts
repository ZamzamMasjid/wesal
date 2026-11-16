// SPEC: docs/architecture/testing.md — integration tests run against real Postgres with per-test isolation
// ROADMAP: phase-1-infrastructure / testing / Configure Vitest projects: unit, and integration against real Postgres with per-test isolation
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { openTestDb, resetDatabase, withRollback } from "@/test/db";
import { aSlotPattern, anOccasion, aStaffUser } from "@/test/factories";

import { occasion, slotPattern, staffUser } from "./schema";

const handle = openTestDb();
const { db } = handle;

beforeEach(() => resetDatabase(handle));
afterAll(() => handle.pool.end());

describe("test database", () => {
  it("has the migrated schema and the btree_gist extension", async () => {
    const r = await db.execute(
      sql`select extname from pg_extension where extname = 'btree_gist'`,
    );
    expect(r.rows).toHaveLength(1);
  });

  it("inserts rows built by the factories", async () => {
    await db.insert(staffUser).values(aStaffUser({ role: "owner" }));
    await db.insert(occasion).values(anOccasion({ priceEgp: 2500 }));
    await db.insert(slotPattern).values(aSlotPattern());
    expect(await db.select().from(occasion)).toMatchObject([
      { priceEgp: 2500 },
    ]);
  });

  it("starts every test from an empty database", async () => {
    expect(await db.select().from(occasion)).toHaveLength(0);
    expect(await db.select().from(staffUser)).toHaveLength(0);
  });

  it("restarts identities between tests", async () => {
    const [row] = await db.insert(occasion).values(anOccasion()).returning();
    expect(row?.id).toBe(1);
  });

  it("rolls back work done in withRollback", async () => {
    const value = await withRollback(handle, async (tx) => {
      await tx.insert(occasion).values(anOccasion());
      return (await tx.select().from(occasion)).length;
    });
    expect(value).toBe(1);
    expect(await db.select().from(occasion)).toHaveLength(0);
  });

  it("rethrows real errors from withRollback", async () => {
    await expect(
      withRollback(handle, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
