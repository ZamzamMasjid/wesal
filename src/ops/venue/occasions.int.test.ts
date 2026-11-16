// SPEC: docs/features/venue-settings — owner maintains occasions with Arabic/English names and one price; inactive occasions are not offered; every change is audited with old and new values; staff cannot change them
// ROADMAP: phase-2-foundations / venue-settings / Implement occasion CRUD API with Arabic/English names and price
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Caller } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { listAudit } from "@/audit/audit";
import { aStaffUser } from "@/test/factories";
import { staffUser } from "@/db/schema";
import { openTestDb, resetDatabase } from "@/test/db";

import { createOccasionOperations } from "./occasions";

const handle = openTestDb();
const { db } = handle;
const ops = createOccasionOperations(() => ({ db }));

beforeEach(() => resetDatabase(handle));
afterAll(() => handle.pool.end());

const ctx = (caller: Caller) => createCallContext(caller, { requestId: "r" });
const anon: Caller = { kind: "anonymous" };

async function makeOwner(): Promise<Caller> {
  const row = aStaffUser({ role: "owner" });
  await db.insert(staffUser).values(row);
  return { kind: "staff", userId: row.id, role: "owner" };
}

const wedding = { nameAr: "زفاف", nameEn: "Wedding", priceEgp: 15000 };

describe("staff.occasions.create", () => {
  it("creates an occasion, appends it to the list and audits it", async () => {
    const owner = await makeOwner();
    const first = await ops.create(wedding, ctx(owner));
    const second = await ops.create(
      { nameAr: "خطوبة", nameEn: "Engagement", priceEgp: 8000 },
      ctx(owner),
    );
    expect(first.ok && first.data).toMatchObject({
      nameEn: "Wedding",
      priceEgp: 15000,
      active: true,
      position: 0,
    });
    expect(second.ok && second.data.position).toBe(1);

    const audit = await listAudit(db, { limit: 5 });
    expect(audit[1]).toMatchObject({
      action: "occasion.create",
      detail: { nameEn: "Wedding", priceEgp: 15000 },
    });
  });

  it("rejects a blank name, a negative or fractional price", async () => {
    const owner = await makeOwner();
    for (const bad of [
      { ...wedding, nameAr: "  " },
      { ...wedding, priceEgp: -1 },
      { ...wedding, priceEgp: 10.5 },
    ]) {
      const result = await ops.create(bad, ctx(owner));
      expect(!result.ok && result.error.code).toBe("VALIDATION_FAILED");
    }
  });
});

describe("staff.occasions.update", () => {
  it("changes the price and audits old and new values", async () => {
    const owner = await makeOwner();
    const created = await ops.create(wedding, ctx(owner));
    if (!created.ok) throw new Error("setup failed");
    const result = await ops.update(
      { id: created.data.id, priceEgp: 18000 },
      ctx(owner),
    );
    expect(result.ok && result.data.priceEgp).toBe(18000);
    const [entry] = await listAudit(db, { limit: 1 });
    expect(entry).toMatchObject({
      action: "occasion.update",
      target: `occasion:${created.data.id}`,
      detail: { priceEgp: { from: 15000, to: 18000 } },
    });
  });

  it("accepts the id as a path string", async () => {
    const owner = await makeOwner();
    const created = await ops.create(wedding, ctx(owner));
    if (!created.ok) throw new Error("setup failed");
    const result = await ops.update(
      { id: String(created.data.id), nameEn: "Marriage" },
      ctx(owner),
    );
    expect(result.ok && result.data.nameEn).toBe("Marriage");
  });

  it("writes no audit row when nothing actually changes", async () => {
    const owner = await makeOwner();
    const created = await ops.create(wedding, ctx(owner));
    if (!created.ok) throw new Error("setup failed");
    await ops.update({ id: created.data.id, priceEgp: 15000 }, ctx(owner));
    expect(await listAudit(db, { limit: 10 })).toHaveLength(1);
  });

  it("returns NOT_FOUND for an unknown occasion and rejects an empty change", async () => {
    const owner = await makeOwner();
    const missing = await ops.update({ id: 999, priceEgp: 1 }, ctx(owner));
    expect(!missing.ok && missing.error.code).toBe("NOT_FOUND");
    const empty = await ops.update({ id: 1 }, ctx(owner));
    expect(!empty.ok && empty.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("listing", () => {
  it("the public list shows only active occasions, in order, without the active flag", async () => {
    const owner = await makeOwner();
    const a = await ops.create(wedding, ctx(owner));
    await ops.create(
      { nameAr: "عزاء", nameEn: "Funeral", priceEgp: 3000 },
      ctx(owner),
    );
    if (!a.ok) throw new Error("setup failed");
    await ops.update({ id: a.data.id, active: false }, ctx(owner));

    const listed = await ops.listPublic({}, ctx(anon));
    expect(listed.ok && listed.data.occasions.map((o) => o.nameEn)).toEqual([
      "Funeral",
    ]);
    expect(listed.ok && Object.keys(listed.data.occasions[0]!)).not.toContain(
      "active",
    );

    const all = await ops.listStaff({}, ctx(owner));
    expect(all.ok && all.data.occasions).toHaveLength(2);
  });

  it("staff cannot list or change occasions", async () => {
    const staff: Caller = { kind: "staff", userId: "s", role: "staff" };
    for (const result of [
      await ops.listStaff({}, ctx(staff)),
      await ops.create(wedding, ctx(staff)),
      await ops.update({ id: 1, priceEgp: 1 }, ctx(staff)),
    ]) {
      expect(!result.ok && result.error.code).toBe("FORBIDDEN");
    }
  });
});
