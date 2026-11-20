// The private booking page's address. Pure and dependency-free so the server
// (when it queues the booking-link message) and the browser (after a hold is
// created) build exactly the same URL. Arabic is the default locale and has no
// prefix; English lives under `/en` (docs/i18n/routing).

export type BookingLocale = "ar" | "en";

/** `ar` → `/booking/<token>`, `en` → `/en/booking/<token>`. */
export function bookingPath(locale: BookingLocale, token: string): string {
  const prefix = locale === "ar" ? "" : `/${locale}`;
  return `${prefix}/booking/${encodeURIComponent(token)}`;
}

/** The absolute link that goes in the WhatsApp/SMS message. */
export function absoluteBookingLink(
  baseUrl: string,
  locale: BookingLocale,
  token: string,
): string {
  return `${baseUrl.replace(/\/+$/, "")}${bookingPath(locale, token)}`;
}
