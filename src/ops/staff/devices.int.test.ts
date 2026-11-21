// SPEC: push-notifications/spec.md — a signed-in staff member registers the device's push token and logout removes it; devices belong to one person
// ROADMAP: phase-7-mobile-app / push-notifications / Implement device registration endpoint and a push sender behind the messaging adapter
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import { staffDevice, staffUser } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { aStaffUser } from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

import { createDeviceOperations, devicesForUser } from "./devices";

const handle = openTestDb();
const { db } = handle;
const ops = createDeviceOperations(() => ({ db }));

const NOW = new Date("2026-12-20T08:00:00Z");
const clock: Clock = { now: () => NOW };
const asUser = (userId: string) => ({
  ...createCallContext({ kind: "staff", userId, role: "staff" }),
  clock,
});
const anonymous = { ...createCallContext({ kind: "anonymous" }), clock };

beforeEach(async () => {
  await resetDatabase(handle);
  await db
    .insert(staffUser)
    .values([
      aStaffUser({ id: "sara", username: "sara" }),
      aStaffUser({ id: "mona", username: "mona" }),
    ]);
});
afterAll(() => handle.pool.end());

const EXPO_TOKEN = "ExponentPushToken[abcdefghijklmnop]";

describe("staff.devices.register", () => {
  it("registers this caller's device", async () => {
    const result = await ops.register(
      { token: EXPO_TOKEN, platform: "android" },
      asUser("sara"),
    );

    expect(result.ok).toBe(true);
    const rows = await db.select().from(staffDevice);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "sara",
      token: EXPO_TOKEN,
      platform: "android",
      active: true,
    });
    expect(await devicesForUser(db, "sara")).toEqual([EXPO_TOKEN]);
  });

  it("moves a token that signs in on another account instead of duplicating it", async () => {
    await ops.register({ token: EXPO_TOKEN, platform: "ios" }, asUser("sara"));

    const again = await ops.register(
      { token: EXPO_TOKEN, platform: "ios" },
      asUser("mona"),
    );

    expect(again.ok).toBe(true);
    const rows = await db.select().from(staffDevice);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe("mona");
    expect(await devicesForUser(db, "sara")).toEqual([]);
    expect(await devicesForUser(db, "mona")).toEqual([EXPO_TOKEN]);
  });

  it("reactivates a token the provider had marked unregistered", async () => {
    await db.insert(staffDevice).values({
      userId: "sara",
      token: EXPO_TOKEN,
      platform: "android",
      active: false,
    });

    await ops.register({ token: EXPO_TOKEN, platform: "android" }, asUser("sara"));

    const [row] = await db.select().from(staffDevice);
    expect(row?.active).toBe(true);
  });

  it("is staff-only", async () => {
    const result = await ops.register(
      { token: EXPO_TOKEN, platform: "android" },
      anonymous,
    );

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("staff.devices.unregister", () => {
  it("removes the caller's device", async () => {
    await ops.register({ token: EXPO_TOKEN, platform: "android" }, asUser("sara"));
    const [row] = await db.select().from(staffDevice);

    const result = await ops.unregister({ id: row!.id }, asUser("sara"));

    expect(result).toMatchObject({ ok: true, data: { unregistered: true } });
    expect(await db.select().from(staffDevice)).toHaveLength(0);
  });

  it("does not remove another person's device", async () => {
    await ops.register({ token: EXPO_TOKEN, platform: "android" }, asUser("sara"));
    const [row] = await db.select().from(staffDevice);

    const result = await ops.unregister({ id: row!.id }, asUser("mona"));

    expect(result.ok).toBe(true);
    expect(await db.select().from(staffDevice)).toHaveLength(1);
  });

  it("is a success for a device that is already gone", async () => {
    const result = await ops.unregister({ id: 999 }, asUser("sara"));
    expect(result).toMatchObject({ ok: true });
  });
});
