// SPEC: docs/features/booking-hold — a hold past its deadline expires on its own; the sweep only makes the stored status truthful
// ROADMAP: phase-3-booking / booking-hold / Implement tidy-up sweep in the job loop marking overdue holds as expired
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { booking, occasion } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { anOccasion, aBooking } from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

import { expireOverdueHolds } from "./sweep";

const handle = openTestDb();
const { db } = handle;
const NOW = new Date("2026-12-20T08:00:00Z");
const clock: Clock = { now: () => NOW };

beforeEach(async () => {
  await resetDatabase(handle);
  await db.insert(occasion).values(anOccasion());
});
afterAll(() => handle.pool.end());

describe("expireOverdueHolds", () => {
  it("marks held bookings whose deadline has passed, including a missing deadline", async () => {
    await db.insert(booking).values([
      aBooking({
        publicId: "PAST1",
        accessToken: "past-1",
        customerPhone: "+201000000001",
        status: "held",
        startsAt: new Date("2026-12-25T16:00:00Z"),
        endsAt: new Date("2026-12-25T18:00:00Z"),
        holdExpiresAt: new Date("2026-12-20T07:59:59Z"),
      }),
      aBooking({
        publicId: "NULL1",
        accessToken: "null-1",
        customerPhone: "+201000000002",
        status: "held",
        startsAt: new Date("2027-01-01T16:00:00Z"),
        endsAt: new Date("2027-01-01T18:00:00Z"),
        holdExpiresAt: null,
      }),
    ]);

    expect(await expireOverdueHolds({ db, clock })).toEqual({ expired: 2 });

    const stored = await db.select().from(booking);
    expect(stored.map((row) => row.status)).toEqual(["expired", "expired"]);
    expect(
      stored.every((row) => row.updatedAt.getTime() === NOW.getTime()),
    ).toBe(true);
  });

  it("leaves a running hold and every other status alone", async () => {
    await db.insert(booking).values([
      aBooking({
        publicId: "LIVE1",
        accessToken: "live-1",
        customerPhone: "+201000000003",
        status: "held",
        startsAt: new Date("2026-12-25T16:00:00Z"),
        endsAt: new Date("2026-12-25T18:00:00Z"),
        holdExpiresAt: new Date("2026-12-20T08:20:00Z"),
      }),
      aBooking({
        publicId: "PROOF",
        accessToken: "proof-1",
        customerPhone: "+201000000004",
        status: "proof_submitted",
        startsAt: new Date("2027-01-01T16:00:00Z"),
        endsAt: new Date("2027-01-01T18:00:00Z"),
        holdExpiresAt: new Date("2026-12-20T07:00:00Z"),
      }),
      aBooking({
        publicId: "DONE1",
        accessToken: "done-1",
        customerPhone: "+201000000005",
        status: "confirmed",
        startsAt: new Date("2027-01-08T16:00:00Z"),
        endsAt: new Date("2027-01-08T18:00:00Z"),
        holdExpiresAt: null,
      }),
      aBooking({
        publicId: "GONE1",
        accessToken: "gone-1",
        customerPhone: "+201000000006",
        status: "cancelled",
        startsAt: new Date("2027-01-15T16:00:00Z"),
        endsAt: new Date("2027-01-15T18:00:00Z"),
        holdExpiresAt: new Date("2026-12-20T07:00:00Z"),
      }),
    ]);

    expect(await expireOverdueHolds({ db, clock })).toEqual({ expired: 0 });

    const stored = await db.select().from(booking);
    expect(stored.map((row) => row.status)).toEqual([
      "held",
      "proof_submitted",
      "confirmed",
      "cancelled",
    ]);
  });

  it("is idempotent", async () => {
    await db.insert(booking).values(
      aBooking({
        publicId: "PAST2",
        accessToken: "past-2",
        customerPhone: "+201000000007",
        status: "held",
        startsAt: new Date("2027-01-22T16:00:00Z"),
        endsAt: new Date("2027-01-22T18:00:00Z"),
        holdExpiresAt: new Date("2026-12-20T07:00:00Z"),
      }),
    );

    expect(await expireOverdueHolds({ db, clock })).toEqual({ expired: 1 });
    expect(await expireOverdueHolds({ db, clock })).toEqual({ expired: 0 });
  });
});
