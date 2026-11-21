// SPEC: docs/features/public-calendar — the availability API returns each day's closed flag and slot states for a range, with expired holds counted as free and near slots call-only
// ROADMAP: phase-3-booking / public-calendar / Implement availability API: slot states for a date range with expiry by timestamp
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import { booking, dateException, occasion, slotPattern } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { aBooking, anOccasion, aSlotPattern } from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

import { createCalendarOperations } from "./availability";

const handle = openTestDb();
const { db } = handle;
const ops = createCalendarOperations(() => ({ db }));

// Sunday 2026-12-20, 10:00 Cairo. Friday slots are 18:00-20:00 Cairo
// (16:00-18:00 UTC), five days away.
const NOW = new Date("2026-12-20T08:00:00Z");
let now = NOW;
const clock: Clock = { now: () => now };
const ctx = { ...createCallContext({ kind: "anonymous" }), clock };

beforeEach(async () => {
  now = NOW;
  await resetDatabase(handle);
  await db
    .insert(slotPattern)
    .values(aSlotPattern({ weekday: 5, startTime: "18:00", endTime: "20:00" }));
  await db.insert(occasion).values(anOccasion());
});
afterAll(() => handle.pool.end());

async function addBooking(
  startsAt: string,
  endsAt: string,
  overrides: Parameters<typeof aBooking>[0] = {},
) {
  await db.insert(booking).values(
    aBooking({
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      ...overrides,
    }),
  );
}

const friday = (day: string) => `${day}T16:00:00Z`;
const fridayEnd = (day: string) => `${day}T18:00:00Z`;

const availability = (from: string, to: string) =>
  ops.availability({ from, to }, ctx);

describe("availability.get", () => {
  it("returns every day of the range with free slots and a book action", async () => {
    const result = await availability("2026-12-24", "2026-12-26");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toMatchObject({
      from: "2026-12-24",
      to: "2026-12-26",
      today: "2026-12-20",
      refreshedAt: NOW.toISOString(),
    });
    expect(result.data.days.map((day) => day.day)).toEqual([
      "2026-12-24",
      "2026-12-25",
      "2026-12-26",
    ]);
    expect(result.data.days[0]?.slots).toEqual([]);

    const open = result.data.days[1];
    expect(open).toMatchObject({ closed: false });
    expect(open?.slots).toEqual([
      {
        start: "18:00",
        end: "20:00",
        state: "free",
        action: "book",
        alert: false,
      },
    ]);
  });

  it("labels a taken slot with its state and offers no action", async () => {
    await addBooking(friday("2026-12-25"), fridayEnd("2026-12-25"), {
      status: "confirmed",
    });
    await addBooking(friday("2027-01-01"), fridayEnd("2027-01-01"), {
      status: "proof_submitted",
    });
    await addBooking(friday("2027-01-08"), fridayEnd("2027-01-08"), {
      status: "held",
      holdExpiresAt: new Date("2026-12-20T08:20:00Z"),
    });

    const result = await availability("2026-12-25", "2027-01-08");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const slot = (day: string) =>
      result.data.days.find((entry) => entry.day === day)?.slots[0];
    expect(slot("2026-12-25")).toMatchObject({
      state: "confirmed",
      action: "none",
      alert: false,
    });
    expect(slot("2027-01-01")).toMatchObject({
      state: "awaiting_review",
      action: "none",
      alert: true,
    });
    expect(slot("2027-01-08")).toMatchObject({
      state: "awaiting_payment",
      action: "none",
      alert: true,
    });
  });

  it("counts an expired hold as free, whether or not it was swept", async () => {
    await addBooking(friday("2026-12-25"), fridayEnd("2026-12-25"), {
      status: "held",
      holdExpiresAt: new Date("2026-12-20T07:59:59Z"),
    });
    await addBooking(friday("2027-01-01"), fridayEnd("2027-01-01"), {
      status: "held",
      holdExpiresAt: null,
    });

    const result = await availability("2026-12-25", "2027-01-01");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const open = result.data.days.filter((day) => day.slots.length > 0);
    expect(open.map((day) => day.day)).toEqual(["2026-12-25", "2027-01-01"]);
    for (const day of open) {
      expect(day.slots[0]).toMatchObject({ state: "free", action: "book" });
    }
  });

  it("ignores cancelled, rejected and expired bookings, and bookings outside the range", async () => {
    for (const status of ["cancelled", "rejected", "expired"] as const) {
      await addBooking(friday("2026-12-25"), fridayEnd("2026-12-25"), {
        status,
      });
    }
    // Overlaps the 25th's slot but sits before the queried range.
    await addBooking("2026-12-18T16:00:00Z", "2026-12-18T18:00:00Z", {
      status: "confirmed",
    });

    const result = await availability("2026-12-25", "2026-12-25");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.days[0]?.slots[0]).toMatchObject({
      state: "free",
      action: "book",
    });
  });

  it("blocks a slot a booking overlaps partially", async () => {
    await addBooking("2026-12-25T17:00:00Z", "2026-12-25T19:00:00Z", {
      status: "confirmed",
    });
    const result = await availability("2026-12-25", "2026-12-25");
    expect(result.ok && result.data.days[0]?.slots[0]?.state).toBe("confirmed");
  });

  it("reports a closed date and no slots", async () => {
    await db.insert(dateException).values({ day: "2026-12-25", closed: true });
    const result = await availability("2026-12-25", "2026-12-25");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.days[0]).toEqual({
      day: "2026-12-25",
      closed: true,
      slots: [],
    });
  });

  it("offers a call instead of booking inside the near-slot cutoff", async () => {
    // 17:00 Cairo on the booked Friday; the 18:00 slot is an hour away.
    now = new Date("2026-12-25T15:00:00Z");
    const result = await availability("2026-12-25", "2026-12-25");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.today).toBe("2026-12-25");
    expect(result.data.days[0]?.slots[0]).toMatchObject({
      state: "free",
      action: "call",
    });
  });

  it("offers no action on a slot that has already started", async () => {
    now = new Date("2026-12-25T17:00:00Z"); // 19:00 Cairo
    const result = await availability("2026-12-25", "2026-12-25");
    expect(result.ok && result.data.days[0]?.slots[0]?.action).toBe("none");
  });

  it("validates the range", async () => {
    const bad = async (from: string, to: string) => {
      const result = await availability(from, to);
      return result.ok ? undefined : result.error.code;
    };
    expect(await bad("2026-12-26", "2026-12-25")).toBe("VALIDATION_FAILED");
    expect(await bad("2026-02-31", "2026-03-01")).toBe("VALIDATION_FAILED");
    expect(await bad("2026-01-01", "2026-03-05")).toBe("VALIDATION_FAILED");
    expect(await bad("2026-01-01", "2026-03-04")).toBeUndefined();
  });
});
