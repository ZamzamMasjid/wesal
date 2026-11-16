import { VENUE_TIME_ZONE } from "@/lib/clock";

// Reads an instant as the venue's wall-clock date and time (Africa/Cairo), the
// frame every slot is defined in.

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VENUE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface CairoParts {
  /** Calendar date, `YYYY-MM-DD`. */
  day: string;
  /** Wall-clock time, `HH:MM`. */
  time: string;
}

export function cairoParts(instant: Date): CairoParts {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(instant)) parts[p.type] = p.value;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** The venue's calendar date for an instant. */
export function cairoDay(instant: Date): string {
  return cairoParts(instant).day;
}

/** Weekday of a `YYYY-MM-DD` date: 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/** The date after `day`, `n` days later (negative for earlier). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const DAY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** True for a real calendar date written `YYYY-MM-DD` (rejects 2026-02-31). */
export function isValidDay(day: string): boolean {
  if (!DAY_PATTERN.test(day)) return false;
  return new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}
