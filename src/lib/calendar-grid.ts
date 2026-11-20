// Month-grid arithmetic for the public calendar. Pure and locale-aware, so the
// grid, its labels and the keyboard handler can be tested without a browser.

import { weekdayOf } from "./cairo-time";

/** `YYYY-MM` → the first day of that month, `YYYY-MM-DD`. */
export function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

/** Days in a `YYYY-MM` month. */
export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
}

/** `YYYY-MM` → the last day of that month, `YYYY-MM-DD`. */
export function lastDayOfMonth(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

/** The month of a `YYYY-MM-DD` date. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** Moves `n` months from a `YYYY-MM` month (negative for earlier). */
export function addMonths(month: string, n: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const moved = new Date(Date.UTC(year!, monthNumber! - 1 + n, 1));
  return moved.toISOString().slice(0, 7);
}

/**
 * The month laid out as six weeks of seven cells, starting on Saturday. `null`
 * cells pad the first and last weeks so the grid keeps a stable height.
 */
export function monthCells(month: string): (string | null)[] {
  const first = firstDayOfMonth(month);
  // 0 = Sunday ... 6 = Saturday; the week starts on Saturday (slot-schedule).
  const offset = (weekdayOf(first) + 1) % 7;
  const total = daysInMonth(month);
  const cells: (string | null)[] = Array.from({ length: 42 }, () => null);
  for (let day = 1; day <= total; day++) {
    cells[offset + day - 1] = `${month}-${String(day).padStart(2, "0")}`;
  }
  return cells;
}

/** The day-of-month number shown in a cell. */
export function dayNumber(day: string): number {
  return Number(day.slice(8, 10));
}

const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

/** Short weekday names in the grid's column order (Saturday first). */
export function weekdayHeaders(locale: string): string[] {
  return WEEK_ORDER.map((weekday) => {
    // 2026-12-26 is a Saturday; weekday 0 is Sunday, so it lands on the 27th.
    const date = new Date(Date.UTC(2026, 11, 26 + ((weekday + 1) % 7)));
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(date);
  });
}

/** "نوفمبر 2026" / "November 2026". */
export function monthLabel(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${firstDayOfMonth(month)}T00:00:00Z`));
}

/** "الأحد 15 نوفمبر" / "Sunday 15 November". */
export function longDayLabel(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** "الأحد 15 نوفمبر 2026" / "Sunday 15 November 2026". */
export function fullDayLabel(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** The day when a month is opened: today if it is in the month, else its first day. */
export function defaultDay(month: string, today: string): string {
  return monthOf(today) === month ? today : firstDayOfMonth(month);
}

/**
 * The day the calendar opens on: today when it still has a bookable slot,
 * otherwise the first such day; the month's first day when nothing is open.
 */
export function firstOpenDay(
  days: { day: string; closed: boolean; slots: { action: string }[] }[],
  today: string,
): string {
  const open = days.find(
    (day) =>
      day.day >= today &&
      !day.closed &&
      day.slots.some((slot) => slot.action !== "none"),
  );
  return open?.day ?? today;
}
