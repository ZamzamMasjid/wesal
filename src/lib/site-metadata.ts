import type { Metadata } from "next";

import { localized, type Locale } from "./site-text";

// The landing page's search and share metadata (docs/features/landing-page):
// Arabic is the canonical default at `/`, English lives at `/en`, and each
// language points at the other with `hreflang`. Pure so the shape is tested.

export interface HomeMetadataInput {
  locale: Locale;
  /** The venue name in the reader's language. */
  venueName: string;
  /** The tagline, used when the description is empty. */
  tagline: string;
  descriptionAr: string;
  descriptionEn: string;
  hero: { url: string; altAr: string; altEn: string } | null;
  /** The public origin, e.g. https://wesal.example. */
  baseUrl: string;
}

export function homeMetadata(input: HomeMetadataInput): Metadata {
  const { locale, venueName, baseUrl } = input;
  const description =
    localized(input.descriptionAr, input.descriptionEn, locale).trim() ||
    input.tagline;
  const heroAlt = input.hero
    ? localized(input.hero.altAr, input.hero.altEn, locale)
    : "";
  const image = input.hero
    ? new URL(input.hero.url, baseUrl).toString()
    : undefined;
  const title = `${venueName} — ${input.tagline}`;
  const canonical = locale === "ar" ? "/" : "/en";

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ar: "/",
        en: "/en",
        "x-default": "/",
      },
    },
    openGraph: {
      type: "website",
      siteName: venueName,
      title,
      description,
      url: canonical,
      locale: locale === "ar" ? "ar_EG" : "en_GB",
      ...(image ? { images: [{ url: image, alt: heroAlt || venueName }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

/** The deployed origin, or the development default when it is not configured. */
export function publicBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.PUBLIC_BASE_URL ?? env.BETTER_AUTH_URL;
  return (configured?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}
