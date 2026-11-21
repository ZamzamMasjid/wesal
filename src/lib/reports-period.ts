import { addDays, isValidDay } from "./cairo-time";
import {
  addMonths,
  firstDayOfMonth,
  lastDayOfMonth,
  monthOf,
} from "./calendar-grid";

// Period arithmetic for the reports view (docs/features/booking-reports): a
// month, a year or a custom range of Africa/Cairo calendar days. Pure so the
// picker and its tests share one definition of "the previous month".

export type ReportPeriod =
  | { kind: "month"; month: string }
  | { kind: "year"; year: string }
  | { kind: "range"; from: string; to: string };

export interface PeriodRange {
  /** `YYYY-MM-DD`, inclusive. */
  from: string;
  /** `YYYY-MM-DD`, inclusive. */
  to: string;
}

export function periodRange(period: ReportPeriod): PeriodRange {
  switch (period.kind) {
    case "month":
      return {
        from: firstDayOfMonth(period.month),
        to: lastDayOfMonth(period.month),
      };
    case "year":
      return { from: `${period.year}-01-01`, to: `${period.year}-12-31` };
    case "range":
      return { from: period.from, to: period.to };
  }
}

/** Days between two calendar dates, inclusive of both ends. */
export function periodDays(from: string, to: string): number {
  return (
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    ) + 1
  );
}

/** Moves a period by whole periods: one month, one year or one range length. */
export function shiftPeriod(period: ReportPeriod, step: number): ReportPeriod {
  switch (period.kind) {
    case "month":
      return { kind: "month", month: addMonths(period.month, step) };
    case "year":
      return { kind: "year", year: String(Number(period.year) + step) };
    case "range": {
      const shift = step * periodDays(period.from, period.to);
      return {
        kind: "range",
        from: addDays(period.from, shift),
        to: addDays(period.to, shift),
      };
    }
  }
}

/** A period starting from a range: the month or year it begins in. */
export function periodFromRange(
  kind: "month" | "year",
  range: PeriodRange,
): ReportPeriod {
  return kind === "month"
    ? { kind: "month", month: monthOf(range.from) }
    : { kind: "year", year: range.from.slice(0, 4) };
}

/**
 * Whether the period is well formed: both ends are real dates and the order is
 * right. A malformed hand-typed value leaves the figures where they were.
 */
export function isValidPeriod(period: ReportPeriod): boolean {
  if (period.kind === "range") {
    return (
      isValidDay(period.from) &&
      isValidDay(period.to) &&
      period.from <= period.to
    );
  }
  if (period.kind === "month") {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(period.month);
  }
  return /^\d{4}$/.test(period.year);
}
