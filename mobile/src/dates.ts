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
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
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
