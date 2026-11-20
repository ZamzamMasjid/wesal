// SPEC: slot-schedule/spec.md — all times are Africa/Cairo
// ROADMAP: phase-2-foundations / slot-schedule / Implement slot resolver returning a date's slots from pattern plus exceptions
import { describe, expect, it } from "vitest";

import {
  addDays,
  cairoDay,
  cairoInstant,
  cairoParts,
  isValidDay,
  weekdayOf,
} from "./cairo-time";

describe("cairoParts", () => {
  it("reads an instant on the venue's wall clock (UTC+2 in winter)", () => {
    expect(cairoParts(new Date("2026-12-25T14:30:00Z"))).toEqual({
      day: "2026-12-25",
      time: "16:30",
    });
  });

  it("moves to the next calendar day after 22:00 UTC in winter", () => {
    expect(cairoDay(new Date("2026-12-25T22:30:00Z"))).toBe("2026-12-26");
  });

  it("follows daylight saving (UTC+3 in summer)", () => {
    expect(cairoParts(new Date("2026-07-01T20:30:00Z"))).toEqual({
      day: "2026-07-01",
      time: "23:30",
    });
  });
});

describe("cairoInstant", () => {
  it("turns a wall-clock slot into the right instant in winter", () => {
    expect(cairoInstant("2026-12-25", "16:30").toISOString()).toBe(
      "2026-12-25T14:30:00.000Z",
    );
    expect(cairoInstant("2026-12-25", "00:00").toISOString()).toBe(
      "2026-12-24T22:00:00.000Z",
    );
  });

  it("uses the summer offset", () => {
    expect(cairoInstant("2026-07-01", "16:30").toISOString()).toBe(
      "2026-07-01T13:30:00.000Z",
    );
  });
});

describe("date helpers", () => {
  it("numbers weekdays from Sunday", () => {
    expect(weekdayOf("2026-12-25")).toBe(5);
    expect(weekdayOf("2026-12-27")).toBe(0);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });

  it("rejects impossible dates", () => {
    expect(isValidDay("2026-02-31")).toBe(false);
    expect(isValidDay("2026-2-3")).toBe(false);
    expect(isValidDay("2026-12-25")).toBe(true);
  });
});
