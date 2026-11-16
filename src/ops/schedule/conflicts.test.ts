// SPEC: slot-schedule/spec.md — an edit that would remove or change a slot on a date with an active booking is refused, with a list of the affected bookings
// ROADMAP: phase-2-foundations / slot-schedule / Guard schedule edits against dates that have active bookings
import { describe, expect, it } from "vitest";

import { findConflicts, type ScheduleBooking } from "./conflicts";
import { resolveDay, type PatternSlot } from "./resolver";

const friday: PatternSlot[] = [
  { weekday: 5, start: "14:00", end: "16:00" },
  { weekday: 5, start: "16:30", end: "19:00" },
];

// 14:00-16:00 Cairo on Friday 2026-12-25 is 12:00-14:00 UTC.
const booking = (id: number, start: string, end: string): ScheduleBooking => ({
  id,
  startsAt: new Date(start),
  endsAt: new Date(end),
});
const b1 = booking(1, "2026-12-25T12:00:00Z", "2026-12-25T14:00:00Z");

const resolver = (pattern: PatternSlot[]) => (day: string) =>
  resolveDay(day, pattern, undefined);

describe("findConflicts", () => {
  it("allows an edit that leaves the booked slot as it is", () => {
    const after = [...friday, { weekday: 5, start: "20:00", end: "22:00" }];
    expect(findConflicts([b1], resolver(friday), resolver(after))).toEqual([]);
  });

  it("refuses removing the booked slot", () => {
    const after = friday.slice(1);
    expect(findConflicts([b1], resolver(friday), resolver(after))).toEqual([
      {
        id: 1,
        startsAt: "2026-12-25T12:00:00.000Z",
        endsAt: "2026-12-25T14:00:00.000Z",
      },
    ]);
  });

  it("refuses changing the booked slot's times", () => {
    const after = [{ weekday: 5, start: "14:00", end: "16:30" }, friday[1]!];
    expect(findConflicts([b1], resolver(friday), resolver(after))).toHaveLength(
      1,
    );
  });

  it("ignores bookings on dates the edit does not change", () => {
    // Saturday 2026-12-26: the Friday-only change does not touch it.
    const saturday = booking(2, "2026-12-26T12:00:00Z", "2026-12-26T14:00:00Z");
    const before = [...friday, { weekday: 6, start: "14:00", end: "16:00" }];
    expect(
      findConflicts([saturday], resolver(before), resolver(friday)),
    ).toEqual([
      { id: 2, startsAt: expect.any(String), endsAt: expect.any(String) },
    ]);
    const change = [...before, { weekday: 5, start: "20:00", end: "21:00" }];
    expect(
      findConflicts([saturday], resolver(before), resolver(change)),
    ).toEqual([]);
  });

  it("refuses closing a date that has a booking", () => {
    const before = (day: string) => resolveDay(day, friday, undefined);
    const after = (day: string) =>
      resolveDay(day, friday, { day, closed: true, note: null, slots: [] });
    expect(findConflicts([b1], before, after)).toHaveLength(1);
  });

  it("lists conflicts in date order", () => {
    const later = booking(3, "2026-12-25T14:30:00Z", "2026-12-25T17:00:00Z");
    const result = findConflicts([later, b1], resolver(friday), resolver([]));
    expect(result.map((c) => c.id)).toEqual([1, 3]);
  });
});
