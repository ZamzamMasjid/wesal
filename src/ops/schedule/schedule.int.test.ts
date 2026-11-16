// SPEC: slot-schedule/spec.md — owner edits the weekly pattern and date exceptions; slots may not overlap; edits are audited and guarded against active bookings; only the owner may edit
// ROADMAP: phase-2-foundations / slot-schedule / Implement weekly slot pattern schema and API with overlap validation
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Caller } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { listAudit } from "@/audit/audit";
import { staffUser } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { openTestDb, resetDatabase } from "@/test/db";
import { aStaffUser } from "@/test/factories";

import type { ScheduleBooking } from "./conflicts";
import { resolveRange, resolveSlots } from "./resolver";
import { createScheduleOperations } from "./schedule";

const handle = openTestDb();
const { db } = handle;

let bookings: ScheduleBooking[] = [];
const ops = createScheduleOperations(() => ({
  db,
  activeBookings: async () => bookings,
}));

// "Now" is Thursday 2026-12-24, 10:00 Cairo.
const clock: Clock = { now: () => new Date("2026-12-24T08:00:00Z") };

beforeEach(async () => {
  bookings = [];
  await resetDatabase(handle);
});
afterAll(() => handle.pool.end());

const ctx = (caller: Caller) => ({
  ...createCallContext(caller, { requestId: "r" }),
  clock,
});

async function makeOwner(): Promise<Caller> {
  const row = aStaffUser({ role: "owner" });
  await db.insert(staffUser).values(row);
  return { kind: "staff", userId: row.id, role: "owner" };
}

const friday = (start: string, end: string) => ({ weekday: 5, start, end });

describe("staff.schedule.pattern", () => {
  it("is empty before the owner sets anything", async () => {
    const owner = await makeOwner();
    const result = await ops.getPattern({}, ctx(owner));
    expect(result.ok && result.data.slots).toEqual([]);
  });

  it("saves the whole pattern, sorted, and reads it back as HH:MM", async () => {
    const owner = await makeOwner();
    const saved = await ops.putPattern(
      {
        slots: [
          friday("16:30", "19:00"),
          friday("14:00", "16:00"),
          { weekday: 6, start: "10:00", end: "12:00" },
        ],
      },
      ctx(owner),
    );
    expect(saved.ok && saved.data.slots).toEqual([
      friday("14:00", "16:00"),
      friday("16:30", "19:00"),
      { weekday: 6, start: "10:00", end: "12:00" },
    ]);
    const read = await ops.getPattern({}, ctx(owner));
    expect(read.ok && read.data.slots).toHaveLength(3);
  });

  it("replaces the previous pattern and can empty it", async () => {
    const owner = await makeOwner();
    await ops.putPattern({ slots: [friday("14:00", "16:00")] }, ctx(owner));
    await ops.putPattern({ slots: [friday("18:00", "20:00")] }, ctx(owner));
    expect(await ops.getPattern({}, ctx(owner))).toMatchObject({
      data: { slots: [friday("18:00", "20:00")] },
    });
    await ops.putPattern({ slots: [] }, ctx(owner));
    expect(await ops.getPattern({}, ctx(owner))).toMatchObject({
      data: { slots: [] },
    });
  });

  it("refuses overlapping slots on one day and names the offender", async () => {
    const owner = await makeOwner();
    const result = await ops.putPattern(
      { slots: [friday("14:00", "17:00"), friday("16:30", "19:00")] },
      ctx(owner),
    );
    expect(!result.ok && result.error.code).toBe("VALIDATION_FAILED");
    expect(!result.ok && result.error.details).toMatchObject({
      issues: [{ path: "slots.1.start" }],
    });
    expect(await ops.getPattern({}, ctx(owner))).toMatchObject({
      data: { slots: [] },
    });
  });

  it("allows the same times on different days and slots that touch", async () => {
    const owner = await makeOwner();
    const result = await ops.putPattern(
      {
        slots: [
          friday("14:00", "16:00"),
          friday("16:00", "18:00"),
          { weekday: 6, start: "14:00", end: "16:00" },
        ],
      },
      ctx(owner),
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    ["ends before it starts", friday("16:00", "14:00")],
    ["has zero length", friday("14:00", "14:00")],
    ["has an invalid time", friday("25:00", "26:00")],
    ["has an invalid weekday", { weekday: 7, start: "14:00", end: "16:00" }],
  ])("refuses a slot that %s", async (_label, slot) => {
    const owner = await makeOwner();
    const result = await ops.putPattern({ slots: [slot] }, ctx(owner));
    expect(!result.ok && result.error.code).toBe("VALIDATION_FAILED");
  });

  it("audits old and new, and skips the audit when nothing changed", async () => {
    const owner = await makeOwner();
    const slots = [friday("14:00", "16:00")];
    await ops.putPattern({ slots }, ctx(owner));
    await ops.putPattern({ slots }, ctx(owner));
    const entries = await listAudit(db, { limit: 10 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "schedule.pattern.update",
      detail: { from: [], to: slots },
    });
  });

  it("refuses an edit that removes a slot with an active booking, listing it", async () => {
    const owner = await makeOwner();
    await ops.putPattern(
      { slots: [friday("14:00", "16:00"), friday("16:30", "19:00")] },
      ctx(owner),
    );
    // Friday 2026-12-25 14:00-16:00 Cairo.
    bookings = [
      {
        id: 7,
        startsAt: new Date("2026-12-25T12:00:00Z"),
        endsAt: new Date("2026-12-25T14:00:00Z"),
      },
    ];
    const result = await ops.putPattern(
      { slots: [friday("16:30", "19:00")] },
      ctx(owner),
    );
    expect(!result.ok && result.error.code).toBe("SCHEDULE_CONFLICT");
    expect(!result.ok && result.error.details).toMatchObject({
      bookings: [{ id: 7 }],
    });
    const read = await ops.getPattern({}, ctx(owner));
    expect(read.ok && read.data.slots).toHaveLength(2);

    // Adding a slot beside the booked one is fine.
    const ok = await ops.putPattern(
      {
        slots: [
          friday("14:00", "16:00"),
          friday("16:30", "19:00"),
          friday("20:00", "22:00"),
        ],
      },
      ctx(owner),
    );
    expect(ok.ok).toBe(true);
  });

  it("does not let a pattern change affect a date that has its own exception", async () => {
    const owner = await makeOwner();
    await ops.putPattern({ slots: [friday("14:00", "16:00")] }, ctx(owner));
    await ops.putException(
      {
        date: "2026-12-25",
        closed: false,
        slots: [{ start: "10:00", end: "13:00" }],
      },
      ctx(owner),
    );
    // The booking sits on the exception's slot; removing the pattern slot is fine.
    bookings = [
      {
        id: 8,
        startsAt: new Date("2026-12-25T08:00:00Z"),
        endsAt: new Date("2026-12-25T11:00:00Z"),
      },
    ];
    const result = await ops.putPattern({ slots: [] }, ctx(owner));
    expect(result.ok).toBe(true);
  });
});

describe("staff.schedule.exceptions", () => {
  it("blocks a date with an optional note", async () => {
    const owner = await makeOwner();
    const result = await ops.putException(
      { date: "2026-12-25", closed: true, note: " maintenance " },
      ctx(owner),
    );
    expect(result.ok && result.data).toEqual({
      day: "2026-12-25",
      closed: true,
      note: "maintenance",
      slots: [],
    });
  });

  it("gives a date its own slots, replacing the pattern for that date", async () => {
    const owner = await makeOwner();
    await ops.putPattern({ slots: [friday("14:00", "16:00")] }, ctx(owner));
    await ops.putException(
      {
        date: "2026-12-25",
        closed: false,
        slots: [
          { start: "13:00", end: "18:00" },
          { start: "10:00", end: "12:00" },
        ],
      },
      ctx(owner),
    );
    expect(await resolveSlots(db, "2026-12-25")).toMatchObject({
      source: "exception",
      slots: [
        { start: "10:00", end: "12:00" },
        { start: "13:00", end: "18:00" },
      ],
    });
    // The next Friday still follows the pattern.
    expect(await resolveSlots(db, "2027-01-01")).toMatchObject({
      source: "pattern",
      slots: [{ start: "14:00", end: "16:00" }],
    });
  });

  it("replaces an existing exception for the date", async () => {
    const owner = await makeOwner();
    await ops.putException({ date: "2026-12-25", closed: true }, ctx(owner));
    await ops.putException(
      {
        date: "2026-12-25",
        closed: false,
        slots: [{ start: "10:00", end: "12:00" }],
      },
      ctx(owner),
    );
    const list = await ops.listExceptions({}, ctx(owner));
    expect(list.ok && list.data.exceptions).toEqual([
      {
        day: "2026-12-25",
        closed: false,
        note: null,
        slots: [{ start: "10:00", end: "12:00" }],
      },
    ]);
    const entries = await listAudit(db, { limit: 10 });
    expect(entries.map((e) => e.action)).toEqual([
      "schedule.exception.update",
      "schedule.exception.create",
    ]);
  });

  it("validates slots, closed/slots consistency and the date", async () => {
    const owner = await makeOwner();
    const bad = async (input: unknown) => {
      const result = await ops.putException(input, ctx(owner));
      return !result.ok && result.error.code;
    };
    expect(
      await bad({
        date: "2026-12-25",
        closed: true,
        slots: [{ start: "10:00", end: "12:00" }],
      }),
    ).toBe("VALIDATION_FAILED");
    expect(await bad({ date: "2026-12-25", closed: false, slots: [] })).toBe(
      "VALIDATION_FAILED",
    );
    expect(
      await bad({
        date: "2026-12-25",
        closed: false,
        slots: [
          { start: "10:00", end: "13:00" },
          { start: "12:00", end: "14:00" },
        ],
      }),
    ).toBe("VALIDATION_FAILED");
    expect(await bad({ date: "2026-02-31", closed: true })).toBe(
      "VALIDATION_FAILED",
    );
  });

  it("refuses a date in the past but accepts today", async () => {
    const owner = await makeOwner();
    const past = await ops.putException(
      { date: "2026-12-23", closed: true },
      ctx(owner),
    );
    expect(!past.ok && past.error.code).toBe("VALIDATION_FAILED");
    const today = await ops.putException(
      { date: "2026-12-24", closed: true },
      ctx(owner),
    );
    expect(today.ok).toBe(true);
  });

  it("lists upcoming exceptions only, within an optional range", async () => {
    const owner = await makeOwner();
    // Insert a past one directly: the operation itself refuses past dates.
    const { dateException } = await import("@/db/schema");
    await db.insert(dateException).values({ day: "2026-12-01", closed: true });
    for (const date of ["2026-12-25", "2027-01-10", "2027-03-20"]) {
      await ops.putException({ date, closed: true }, ctx(owner));
    }
    const all = await ops.listExceptions({}, ctx(owner));
    expect(all.ok && all.data.exceptions.map((e) => e.day)).toEqual([
      "2026-12-25",
      "2027-01-10",
      "2027-03-20",
    ]);
    const ranged = await ops.listExceptions(
      { from: "2027-01-01", to: "2027-02-01" },
      ctx(owner),
    );
    expect(ranged.ok && ranged.data.exceptions.map((e) => e.day)).toEqual([
      "2027-01-10",
    ]);
  });

  it("refuses closing or changing a date with an active booking, then allows it once cleared", async () => {
    const owner = await makeOwner();
    await ops.putPattern({ slots: [friday("14:00", "16:00")] }, ctx(owner));
    bookings = [
      {
        id: 9,
        startsAt: new Date("2026-12-25T12:00:00Z"),
        endsAt: new Date("2026-12-25T14:00:00Z"),
      },
    ];
    const closed = await ops.putException(
      { date: "2026-12-25", closed: true },
      ctx(owner),
    );
    expect(!closed.ok && closed.error.code).toBe("SCHEDULE_CONFLICT");
    expect(!closed.ok && closed.error.details).toMatchObject({
      bookings: [{ id: 9 }],
    });

    // Keeping the booked slot among the custom slots is allowed.
    const kept = await ops.putException(
      {
        date: "2026-12-25",
        closed: false,
        slots: [
          { start: "14:00", end: "16:00" },
          { start: "17:00", end: "19:00" },
        ],
      },
      ctx(owner),
    );
    expect(kept.ok).toBe(true);

    bookings = [];
    const after = await ops.putException(
      { date: "2026-12-25", closed: true },
      ctx(owner),
    );
    expect(after.ok).toBe(true);
  });

  it("deletes an exception, returning the date to the pattern, and audits it", async () => {
    const owner = await makeOwner();
    await ops.putPattern({ slots: [friday("14:00", "16:00")] }, ctx(owner));
    await ops.putException({ date: "2026-12-25", closed: true }, ctx(owner));
    const removed = await ops.deleteException(
      { date: "2026-12-25" },
      ctx(owner),
    );
    expect(removed.ok).toBe(true);
    expect(await resolveSlots(db, "2026-12-25")).toMatchObject({
      closed: false,
      source: "pattern",
    });
    const [entry] = await listAudit(db, { limit: 1 });
    expect(entry).toMatchObject({
      action: "schedule.exception.delete",
      target: "schedule:date:2026-12-25",
    });
  });

  it("refuses deleting an exception whose custom slot has a booking", async () => {
    const owner = await makeOwner();
    await ops.putException(
      {
        date: "2026-12-25",
        closed: false,
        slots: [{ start: "10:00", end: "13:00" }],
      },
      ctx(owner),
    );
    bookings = [
      {
        id: 10,
        startsAt: new Date("2026-12-25T08:00:00Z"),
        endsAt: new Date("2026-12-25T11:00:00Z"),
      },
    ];
    const result = await ops.deleteException(
      { date: "2026-12-25" },
      ctx(owner),
    );
    expect(!result.ok && result.error.code).toBe("SCHEDULE_CONFLICT");
  });

  it("returns NOT_FOUND when deleting a date with no exception", async () => {
    const owner = await makeOwner();
    const result = await ops.deleteException(
      { date: "2026-12-25" },
      ctx(owner),
    );
    expect(!result.ok && result.error.code).toBe("NOT_FOUND");
  });
});

describe("resolver over the database", () => {
  it("resolves a range of dates from pattern and exceptions", async () => {
    const owner = await makeOwner();
    await ops.putPattern({ slots: [friday("14:00", "16:00")] }, ctx(owner));
    await ops.putException({ date: "2026-12-25", closed: true }, ctx(owner));
    const days = await resolveRange(db, "2026-12-24", "2027-01-01");
    expect(days.map((d) => d.day)).toHaveLength(9);
    expect(days.find((d) => d.day === "2026-12-25")).toMatchObject({
      closed: true,
      slots: [],
    });
    expect(days.find((d) => d.day === "2027-01-01")).toMatchObject({
      closed: false,
      slots: [{ start: "14:00", end: "16:00" }],
    });
    expect(days.find((d) => d.day === "2026-12-24")?.slots).toEqual([]);
  });
});
