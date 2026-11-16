// SPEC: slot-schedule/spec.md — a date's slots are its exception's slots if one exists, otherwise the weekday's pattern; slots on one date may not overlap
// ROADMAP: phase-2-foundations / slot-schedule / Implement slot resolver returning a date's slots from pattern plus exceptions
import { describe, expect, it } from "vitest";

import {
  findOverlap,
  resolveDay,
  trimTime,
  type DateException,
  type PatternSlot,
} from "./resolver";

// 2026-12-25 is a Friday (weekday 5); 2026-12-26 is a Saturday (6).
const pattern: PatternSlot[] = [
  { weekday: 5, start: "16:30", end: "19:00" },
  { weekday: 5, start: "14:00", end: "16:00" },
  { weekday: 6, start: "10:00", end: "12:00" },
];

describe("resolveDay", () => {
  it("uses the weekday's pattern, sorted by start", () => {
    expect(resolveDay("2026-12-25", pattern, undefined)).toEqual({
      day: "2026-12-25",
      closed: false,
      source: "pattern",
      slots: [
        { start: "14:00", end: "16:00" },
        { start: "16:30", end: "19:00" },
      ],
    });
  });

  it("returns no slots for a weekday with no pattern", () => {
    const day = resolveDay("2026-12-27", pattern, undefined);
    expect(day.slots).toEqual([]);
    expect(day.closed).toBe(false);
  });

  it("lets an exception's slots replace the pattern for that date only", () => {
    const exception: DateException = {
      day: "2026-12-25",
      closed: false,
      note: null,
      slots: [{ start: "10:00", end: "13:00" }],
    };
    expect(resolveDay("2026-12-25", pattern, exception)).toMatchObject({
      source: "exception",
      slots: [{ start: "10:00", end: "13:00" }],
    });
    expect(resolveDay("2026-12-26", pattern, undefined).slots).toHaveLength(1);
  });

  it("returns a closed date with no slots even if slots are present", () => {
    const exception: DateException = {
      day: "2026-12-25",
      closed: true,
      note: "maintenance",
      slots: [{ start: "10:00", end: "13:00" }],
    };
    expect(resolveDay("2026-12-25", pattern, exception)).toMatchObject({
      closed: true,
      slots: [],
      source: "exception",
    });
  });
});

describe("findOverlap", () => {
  it("accepts slots that touch end to start", () => {
    expect(
      findOverlap([
        { start: "14:00", end: "16:00" },
        { start: "16:00", end: "18:00" },
      ]),
    ).toBeNull();
  });

  it("reports the first overlapping pair regardless of input order", () => {
    expect(
      findOverlap([
        { start: "16:30", end: "19:00" },
        { start: "14:00", end: "17:00" },
      ]),
    ).toEqual([
      { start: "14:00", end: "17:00" },
      { start: "16:30", end: "19:00" },
    ]);
  });
});

describe("trimTime", () => {
  it("drops the seconds Postgres adds", () => {
    expect(trimTime("14:00:00")).toBe("14:00");
  });
});
