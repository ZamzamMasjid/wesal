import { and, asc, gte, inArray, lte } from "drizzle-orm";

import type { Database } from "@/db/client";
import { dateException, exceptionSlot, slotPattern } from "@/db/schema";
import { addDays, weekdayOf } from "@/lib/cairo-time";

// The slot resolver (docs/features/slot-schedule). Slots are computed, never
// stored per date: a date's slots are its exception's slots if it has one,
// otherwise its weekday's pattern. `public-calendar` and `booking-hold` call
// this; it is the only place that rule lives.

export interface Slot {
  /** `HH:MM`, Africa/Cairo wall clock. */
  start: string;
  end: string;
}

export interface PatternSlot extends Slot {
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number;
}

export interface DateException {
  day: string;
  closed: boolean;
  note: string | null;
  slots: Slot[];
}

export interface ResolvedDay {
  day: string;
  closed: boolean;
  slots: Slot[];
  /** Where the slots came from. */
  source: "pattern" | "exception";
}

type Reader = Pick<Database, "select">;

/** Postgres returns `HH:MM:SS`; the schedule works in `HH:MM`. */
export function trimTime(value: string): string {
  return value.slice(0, 5);
}

export function compareSlots(a: Slot, b: Slot): number {
  return a.start.localeCompare(b.start) || a.end.localeCompare(b.end);
}

/** The first pair of slots that overlap, or null. Touching ends are allowed. */
export function findOverlap(slots: Slot[]): [Slot, Slot] | null {
  const sorted = [...slots].sort(compareSlots);
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (current.start < previous.end) return [previous, current];
  }
  return null;
}

export function sameSlot(a: Slot, b: Slot): boolean {
  return a.start === b.start && a.end === b.end;
}

/** Pure: the slots of one date from the pattern and that date's exception. */
export function resolveDay(
  day: string,
  pattern: PatternSlot[],
  exception: DateException | undefined,
): ResolvedDay {
  if (exception) {
    return {
      day,
      closed: exception.closed,
      slots: exception.closed ? [] : [...exception.slots].sort(compareSlots),
      source: "exception",
    };
  }
  const weekday = weekdayOf(day);
  const slots = pattern
    .filter((s) => s.weekday === weekday)
    .map(({ start, end }) => ({ start, end }))
    .sort(compareSlots);
  return { day, closed: false, slots, source: "pattern" };
}

export async function loadPattern(db: Reader): Promise<PatternSlot[]> {
  const rows = await db
    .select()
    .from(slotPattern)
    .orderBy(
      asc(slotPattern.weekday),
      asc(slotPattern.startTime),
      asc(slotPattern.endTime),
    );
  return rows.map((r) => ({
    weekday: r.weekday,
    start: trimTime(r.startTime),
    end: trimTime(r.endTime),
  }));
}

/** Exceptions with their slots, for dates in `[from, to]` (inclusive; either end may be omitted). */
export async function loadExceptions(
  db: Reader,
  range?: { from?: string; to?: string },
): Promise<DateException[]> {
  const rows = await db
    .select()
    .from(dateException)
    .where(
      and(
        range?.from ? gte(dateException.day, range.from) : undefined,
        range?.to ? lte(dateException.day, range.to) : undefined,
      ),
    )
    .orderBy(asc(dateException.day));
  if (rows.length === 0) return [];
  const slotRows = await db
    .select()
    .from(exceptionSlot)
    .where(
      inArray(
        exceptionSlot.day,
        rows.map((r) => r.day),
      ),
    )
    .orderBy(asc(exceptionSlot.startTime), asc(exceptionSlot.endTime));
  return rows.map((r) => ({
    day: r.day,
    closed: r.closed,
    note: r.note,
    slots: slotRows
      .filter((s) => s.day === r.day)
      .map((s) => ({ start: trimTime(s.startTime), end: trimTime(s.endTime) })),
  }));
}

/** The slots of each date in `[from, to]` (inclusive), in date order. */
export async function resolveRange(
  db: Reader,
  from: string,
  to: string,
): Promise<ResolvedDay[]> {
  const [pattern, exceptions] = await Promise.all([
    loadPattern(db),
    loadExceptions(db, { from, to }),
  ]);
  const byDay = new Map(exceptions.map((e) => [e.day, e]));
  const days: ResolvedDay[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(resolveDay(day, pattern, byDay.get(day)));
  }
  return days;
}

/** The slots of one date. */
export async function resolveSlots(
  db: Reader,
  day: string,
): Promise<ResolvedDay> {
  const [pattern, exceptions] = await Promise.all([
    loadPattern(db),
    loadExceptions(db, { from: day, to: day }),
  ]);
  const exception = exceptions[0];
  return resolveDay(day, pattern, exception);
}
