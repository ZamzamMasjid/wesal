import type { Locale } from "./i18n";

// Date helpers for the calendar. Cairo is the venue's frame; the phone's own
// timezone is close enough for picking a month, and every server answer carries
// the venue's `today` anyway.

export function cairoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
  }).format(new Date());
}

export function addDays(day: string, days: number): string {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
}

/**
 * The month as six weeks of seven cells, starting on Saturday, exactly like the
 * website's grid. `null` cells pad the first and last weeks.
 */
export function monthCells(month: string): (string | null)[] {
  const first = firstDayOfMonth(month);
  // 0 = Sunday ... 6 = Saturday; the week starts on Saturday.
  const offset = (new Date(`${first}T00:00:00Z`).getUTCDay() + 1) % 7;
  const cells: (string | null)[] = Array.from({ length: 42 }, () => null);
  for (let day = 1; day <= daysInMonth(month); day++) {
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
export function weekdayHeaders(locale: Locale): string[] {
  const tag = locale === "ar" ? "ar" : "en-GB";
  return WEEK_ORDER.map((weekday) => {
    // 2026-12-26 is a Saturday; weekday 0 is Sunday, so it lands on the 27th.
    const date = new Date(Date.UTC(2026, 11, 26 + ((weekday + 1) % 7)));
    return new Intl.DateTimeFormat(tag, {
      weekday: "short",
      timeZone: "UTC",
    }).format(date);
  });
}

/** The day the grid opens on: today if it is in the month, else its first day. */
export function defaultDay(month: string, today: string): string {
  return monthOf(today) === month ? today : firstDayOfMonth(month);
}

/**
 * The day the calendar opens on: today when it still has a bookable slot,
 * otherwise the first such day.
 */
export function firstOpenDay(
  days: { day: string; closed: boolean; slots: { action: string }[] }[],
  today: string,
): string {
  const open = days.find(
    (entry) =>
      entry.day >= today &&
      !entry.closed &&
      entry.slots.some((slot) => slot.action !== "none"),
  );
  return open?.day ?? today;
}

export function lastDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year!, monthNumber!, 0));
  return last.toISOString().slice(0, 10);
}

export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Date(Date.UTC(year!, monthNumber! - 1 + delta, 1));
  return value.toISOString().slice(0, 7);
}

export function monthLabel(month: string, locale: Locale): string {
  // `ar` keeps Western digits in the month heading, as the website's grid does.
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

/** "الأربعاء، 25 نوفمبر" / "Wednesday 25 November" for the selected day. */
export function longDayLabel(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

export function dayLabel(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

export function formatTime(time: string, locale: Locale): string {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour!, minute!)));
}

export function money(locale: Locale, amount: number): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** `mm:ss` (or `h:mm:ss`) for the hold countdown. */
export function countdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(rest).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
