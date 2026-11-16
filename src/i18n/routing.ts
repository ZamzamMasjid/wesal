import { defineRouting } from "next-intl/routing";

// Arabic is the default and has no URL prefix: `/` is Arabic, `/en` is English
// (landing-page spec). Detection is off so `/` never redirects a visitor with an
// English browser; English is chosen with the language switch. The locale cookie
// is off too: it would only be read by detection.
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];

const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(["ar"]);

export function localeDirection(locale: Locale): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}
