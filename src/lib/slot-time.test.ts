// SPEC: slot-schedule/design.md — times shown in 12-hour form, week starts on Saturday, overlap shown inline on the slot
// ROADMAP: phase-2-foundations / slot-schedule / Implement schedule-editor view: weekly grid, exceptions list, block a date
import { describe, expect, it } from "vitest";

import {
  WEEK_ORDER,
  formatDay,
  formatTime,
  nextSlot,
  slotProblems,
  weekdayName,
} from "./slot-time";

describe("formatTime", () => {
  it("shows 12-hour time with a day-period marker", () => {
    expect(formatTime("16:30", "en")).toMatch(/^4:30\s?PM$/i);
    expect(formatTime("00:05", "en")).toMatch(/^12:05\s?AM$/i);
  });

  it("uses the Arabic day-period marker in Arabic", () => {
    expect(formatTime("16:30", "ar")).toMatch(/م$/);
    expect(formatTime("09:00", "ar")).toMatch(/ص$/);
  });
});

describe("weekdayName / formatDay", () => {
  it("names weekdays from a Sunday-based index", () => {
    expect(weekdayName(0, "en")).toBe("Sunday");
    expect(weekdayName(6, "en")).toBe("Saturday");
    expect(weekdayName(5, "ar")).toBe("الجمعة");
  });

  it("starts the week on Saturday", () => {
    expect(WEEK_ORDER.map((d) => weekdayName(d, "en"))[0]).toBe("Saturday");
    expect(WEEK_ORDER).toHaveLength(7);
  });

  it("formats a date", () => {
    expect(formatDay("2026-12-25", "en")).toContain("25");
    expect(formatDay("2026-12-25", "en")).toContain("2026");
  });
});

describe("slotProblems", () => {
  it("flags an empty time, an end before the start, and an overlap", () => {
    const problems = slotProblems([
      { start: "14:00", end: "17:00" },
      { start: "16:30", end: "19:00" },
      { start: "20:00", end: "19:00" },
      { start: "", end: "21:00" },
    ]);
    expect(problems.get(0)).toBeUndefined();
    expect(problems.get(1)).toBe("overlap");
    expect(problems.get(2)).toBe("endBeforeStart");
    expect(problems.get(3)).toBe("empty");
  });

  it("accepts slots that touch", () => {
    expect(
      slotProblems([
        { start: "14:00", end: "16:00" },
        { start: "16:00", end: "18:00" },
      ]).size,
    ).toBe(0);
  });
});

describe("nextSlot", () => {
  it("starts at the default for an empty day", () => {
    expect(nextSlot([])).toEqual({ start: "14:00", end: "15:00" });
  });

  it("continues after the latest slot and stops before midnight", () => {
    expect(nextSlot([{ start: "14:00", end: "16:00" }])).toEqual({
      start: "16:00",
      end: "17:00",
    });
    expect(nextSlot([{ start: "22:00", end: "23:30" }]).end).toBe("23:59");
  });
});
