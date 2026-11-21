import type { MediaItem } from "./content-api";

// What the landing page derives from the owner's content
// (docs/features/landing-page). Pure functions so the fallback rules are tested
// once and apply to the hero, the gallery and the policy alike.

export type Locale = "ar" | "en";

/** An English value left empty falls back to Arabic, so no page shows blanks. */
export function localized(
  arabic: string,
  english: string,
  locale: Locale,
): string {
  if (locale === "ar") return arabic;
  return english.trim() === "" ? arabic : english;
}

/** The venue name in the reader's language, from content or the brand fallback. */
export function venueDescription(
  descriptionAr: string,
  descriptionEn: string,
  locale: Locale,
): string {
  return localized(descriptionAr, descriptionEn, locale);
}

/** Policy text is one rule per line; blank lines are dropped. */
export function policyRules(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((rule) => rule.trim())
    .filter((rule) => rule !== "");
}

/** The description's paragraphs, split on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}

/** The first photo becomes the hero; videos never do. */
export function heroMedia(media: MediaItem[]): MediaItem | null {
  return media.find((item) => item.kind === "photo") ?? null;
}

/** The alternative text for one asset, with the Arabic value as fallback. */
export function mediaAlternative(item: MediaItem, locale: Locale): string {
  return localized(item.altAr, item.altEn, locale);
}

/** An occasion's name, falling back to Arabic when English is empty. */
export function occasionName(
  occasion: { nameAr: string; nameEn: string },
  locale: Locale,
): string {
  return localized(occasion.nameAr, occasion.nameEn, locale);
}

/** Western digits in both languages, grouped (system.md, typography). */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(amount);
}
