// SPEC: docs/architecture/testing.md — infrastructure smoke check: migrations and seed work against real Postgres
// ROADMAP: phase-1-infrastructure / testing / Configure Vitest projects: unit, and integration against real Postgres with per-test isolation
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { openTestDb, resetDatabase, testDatabaseUrl } from "@/test/db";

import { createDb } from "./client";
import { runMigrations } from "./migrate";
import { occasion, slotPattern, staffUser } from "./schema";
import { seed } from "./seed";

const handle = openTestDb();
const { db } = handle;

beforeEach(() => resetDatabase(handle));
afterAll(() => handle.pool.end());

describe("migrations", () => {
  it("are safe to apply again", async () => {
    await expect(runMigrations(testDatabaseUrl())).resolves.toBeUndefined();
  });
});

describe("createDb", () => {
  it("opens a working client", async () => {
    const own = createDb(testDatabaseUrl());
    try {
      expect(await own.db.select().from(occasion)).toEqual([]);
    } finally {
      await own.pool.end();
    }
  });
});

describe("dev seed", () => {
  it("creates an owner, occasions and a weekly pattern", async () => {
    await seed(db);
    expect(await db.select().from(staffUser)).toMatchObject([
      { username: "owner", role: "owner" },
    ]);
    expect((await db.select().from(occasion)).length).toBeGreaterThan(0);
    const slots = await db.select().from(slotPattern);
    expect(new Set(slots.map((s) => s.weekday)).size).toBe(7);
  });

  it("is idempotent", async () => {
    await seed(db);
    const before = (await db.select().from(slotPattern)).length;
    await seed(db);
    expect(await db.select().from(staffUser)).toHaveLength(1);
    expect(await db.select().from(slotPattern)).toHaveLength(before);
  });
});
