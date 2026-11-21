// SPEC: docs/features/venue-settings — owner sets deposit percent (1-100, whole-EGP deposits), hold length, near-slot cutoff, urgent threshold and payment details; every change is audited with old and new values; staff cannot see or change settings
// ROADMAP: phase-2-foundations / venue-settings / Implement settings API: deposit %, payment details, hold length, near-slot cutoff
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Caller } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { listAudit } from "@/audit/audit";
import { staffUser } from "@/db/schema";
import { openTestDb, resetDatabase } from "@/test/db";
import { aStaffUser } from "@/test/factories";

import { createSettingsOperations, depositFor, loadSettings } from "./settings";

const handle = openTestDb();
const { db } = handle;
const ops = createSettingsOperations(() => ({ db }));

beforeEach(() => resetDatabase(handle));
afterAll(() => handle.pool.end());

const ctx = (caller: Caller) => createCallContext(caller, { requestId: "r" });

async function makeOwner(): Promise<Caller> {
  const row = aStaffUser({ role: "owner" });
  await db.insert(staffUser).values(row);
  return { kind: "staff", userId: row.id, role: "owner" };
}

const valid = {
  depositPercent: 30,
  holdMinutes: 20,
  nearSlotCutoffMinutes: 120,
  urgentThresholdMinutes: 1440,
  maxPhotoMb: 25,
  maxVideoMb: 300,
  vodafoneCashNumber: "01012345678",
  instapayAddress: "wesal@instapay",
};

describe("staff.settings.get", () => {
  it("creates the single row with defaults on first read", async () => {
    const owner = await makeOwner();
    const result = await ops.get({}, ctx(owner));
    expect(result.ok && result.data).toEqual({
      depositPercent: 50,
      holdMinutes: 20,
      nearSlotCutoffMinutes: 120,
      urgentThresholdMinutes: 1440,
      maxPhotoMb: 20,
      maxVideoMb: 200,
      vodafoneCashNumber: null,
      instapayAddress: null,
    });
    await ops.get({}, ctx(owner));
    expect(await loadSettings(db)).toBeTruthy();
  });
});

describe("staff.settings.update", () => {
  it("saves the values and audits old and new", async () => {
    const owner = await makeOwner();
    const result = await ops.put(valid, ctx(owner));
    expect(result.ok && result.data).toEqual(valid);
    const [entry] = await listAudit(db, { limit: 1 });
    expect(entry).toMatchObject({
      action: "settings.update",
      detail: {
        depositPercent: { from: 50, to: 30 },
        vodafoneCashNumber: { from: null, to: "01012345678" },
      },
    });
    expect(Object.keys(entry!.detail!)).not.toContain("holdMinutes");
  });

  it("treats empty payment text as not set and writes no audit row for no change", async () => {
    const owner = await makeOwner();
    await ops.put(valid, ctx(owner));
    const cleared = await ops.put(
      { ...valid, vodafoneCashNumber: "  ", instapayAddress: null },
      ctx(owner),
    );
    expect(cleared.ok && cleared.data.vodafoneCashNumber).toBeNull();
    await ops.put(
      { ...valid, vodafoneCashNumber: null, instapayAddress: null },
      ctx(owner),
    );
    expect(await listAudit(db, { limit: 10 })).toHaveLength(2);
  });

  it("rejects a deposit outside 1-100 and non-whole numbers", async () => {
    const owner = await makeOwner();
    for (const bad of [
      { ...valid, depositPercent: 0 },
      { ...valid, depositPercent: 101 },
      { ...valid, depositPercent: 33.5 },
      { ...valid, holdMinutes: 0 },
      { ...valid, nearSlotCutoffMinutes: -1 },
    ]) {
      const result = await ops.put(bad, ctx(owner));
      expect(!result.ok && result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("staff cannot read or change settings", async () => {
    const staff: Caller = { kind: "staff", userId: "s", role: "staff" };
    for (const result of [
      await ops.get({}, ctx(staff)),
      await ops.put(valid, ctx(staff)),
    ]) {
      expect(!result.ok && result.error.code).toBe("FORBIDDEN");
    }
  });
});

describe("depositFor", () => {
  it("rounds the deposit to whole EGP", () => {
    expect(depositFor(15000, 30)).toBe(4500);
    expect(depositFor(3333, 50)).toBe(1667);
    expect(depositFor(1001, 10)).toBe(100);
  });
});
