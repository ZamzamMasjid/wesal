// SPEC: booking-reports/spec.md — the owner picks a month, a year or a range of Africa/Cairo calendar days and moves between periods
// ROADMAP: phase-6-alerts-and-reports / booking-reports / Implement reports view with period filter and export
import { describe, expect, it } from "vitest";

import {
  isValidPeriod,
  periodDays,
  periodFromRange,
  periodRange,
  shiftPeriod,
} from "./reports-period";

describe("report periods", () => {
  it("turns a month into its first and last Cairo day", () => {
    expect(periodRange({ kind: "month", month: "2026-02" })).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(periodRange({ kind: "month", month: "2028-02" })).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });

  it("turns a year into its first and last day", () => {
    expect(periodRange({ kind: "year", year: "2026" })).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("keeps a custom range as written", () => {
    expect(
      periodRange({ kind: "range", from: "2026-03-05", to: "2026-04-10" }),
    ).toEqual({ from: "2026-03-05", to: "2026-04-10" });
  });

  it("steps months and years across year boundaries", () => {
    expect(shiftPeriod({ kind: "month", month: "2026-01" }, -1)).toEqual({
      kind: "month",
      month: "2025-12",
    });
    expect(shiftPeriod({ kind: "year", year: "2026" }, 1)).toEqual({
      kind: "year",
      year: "2027",
    });
  });

  it("slides a custom range by its own length", () => {
    const range = { kind: "range" as const, from: "2026-03-01", to: "2026-03-10" };
    expect(shiftPeriod(range, 1)).toEqual({
      kind: "range",
      from: "2026-03-11",
      to: "2026-03-20",
    });
    expect(shiftPeriod(range, -1)).toEqual({
      kind: "range",
      from: "2026-02-19",
      to: "2026-02-28",
    });
  });

  it("counts both ends of the period", () => {
    expect(periodDays("2026-03-01", "2026-03-01")).toBe(1);
    expect(periodDays("2026-03-01", "2026-03-10")).toBe(10);
  });

  it("starts a month or year period from the range it was showing", () => {
    expect(
      periodFromRange("month", { from: "2026-07-15", to: "2026-08-20" }),
    ).toEqual({ kind: "month", month: "2026-07" });
    expect(
      periodFromRange("year", { from: "2026-07-15", to: "2026-08-20" }),
    ).toEqual({ kind: "year", year: "2026" });
  });

  it("rejects a malformed or backwards period", () => {
    expect(
      isValidPeriod({ kind: "range", from: "2026-03-10", to: "2026-03-01" }),
    ).toBe(false);
    expect(
      isValidPeriod({ kind: "range", from: "2026-02-30", to: "2026-03-01" }),
    ).toBe(false);
    expect(isValidPeriod({ kind: "month", month: "2026-13" })).toBe(false);
    expect(isValidPeriod({ kind: "year", year: "26" })).toBe(false);
    expect(
      isValidPeriod({ kind: "range", from: "2026-03-01", to: "2026-03-10" }),
    ).toBe(true);
  });
});
