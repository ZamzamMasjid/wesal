// Display and editing helpers for the schedule editor. Pure, so they run in the
// browser and in tests. Times are `HH:MM` Africa/Cairo wall-clock strings.

export interface EditableSlot {
  start: string;
  end: string;
}

/** The week starts on Saturday in both languages (slot-schedule design). */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

/** `16:30` shown as "4:30 PM" / "٤:٣٠ م": 12-hour with the locale's day-period marker. */
export function formatTime(time: string, locale: string): string {
  const [h, m] = time.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, h, m));
  return timeFormatter(locale).format(date);
}

// The pickers format a hundred labels each, so build one formatter per locale.
const TIME_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(locale: string): Intl.DateTimeFormat {
  let formatter = TIME_FORMATTERS.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
    TIME_FORMATTERS.set(locale, formatter);
  }
  return formatter;
}

/** The localized name of a weekday (0 = Sunday ... 6 = Saturday). */
export function weekdayName(weekday: number, locale: string): string {
  // 2026-12-27 is a Sunday.
  const date = new Date(Date.UTC(2026, 11, 27 + weekday));
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(date);
}

/** A `YYYY-MM-DD` date in the given locale, e.g. "Fri, 25 Dec 2026". */
export function formatDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

export type SlotProblem =
  "empty" | "invalidTime" | "endBeforeStart" | "overlap";

/** Whether the value is a complete 24-hour `HH:MM` time, as the API expects. */
export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Problems per slot index for one day's slots as the owner is typing them. The
 * server enforces the same rules; this only lets the form say so before saving.
 */
export function slotProblems(slots: EditableSlot[]): Map<number, SlotProblem> {
  const problems = new Map<number, SlotProblem>();
  slots.forEach((s, i) => {
    if (!s.start || !s.end) problems.set(i, "empty");
    else if (!isValidTime(s.start) || !isValidTime(s.end))
      problems.set(i, "invalidTime");
    else if (s.end <= s.start) problems.set(i, "endBeforeStart");
  });
  const valid = slots
    .map((s, index) => ({ ...s, index }))
    .filter((s) => !problems.has(s.index))
    .sort(
      (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
    );
  for (let i = 1; i < valid.length; i++) {
    if (valid[i]!.start < valid[i - 1]!.end) {
      problems.set(valid[i]!.index, "overlap");
    }
  }
  return problems;
}

/** Slots in display order (by start time). */
export function sortSlots<T extends EditableSlot>(slots: T[]): T[] {
  return [...slots].sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
  );
}

/** A new slot that starts where the last one ends (or at a default), one hour long. */
export function nextSlot(existing: EditableSlot[]): EditableSlot {
  const last = sortSlots(existing.filter((s) => s.end)).at(-1);
  const start = last ? last.end : "14:00";
  const [h, m] = start.split(":").map(Number);
  const endMinutes = Math.min(h! * 60 + m! + 60, 23 * 60 + 59);
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  return { start, end };
}
