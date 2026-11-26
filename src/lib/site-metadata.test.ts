// SPEC: docs/features/landing-page — Arabic is the canonical default; Arabic and English have their own URL with hreflang; the page carries Open Graph title, description and hero image
// ROADMAP: phase-5-public-site / landing-page / Add SEO metadata, Open Graph and hreflang for Arabic and English
import { describe, expect, it } from "vitest";

import { homeMetadata, publicBaseUrl } from "./site-metadata";

const input = {
  venueName: "Wesal Mosque and Event Hall",
  descriptionAr: "قاعة للمناسبات",
  descriptionEn: "A hall for occasions",
  hero: {
    url: "/api/v1/media/3",
    altAr: "القاعة",
    altEn: "The hall",
  },
  baseUrl: "https://wesal.example",
};

describe("homeMetadata", () => {
  it("marks Arabic as canonical and lists both languages", () => {
    const meta = homeMetadata({ ...input, locale: "ar" });
    expect(meta.alternates).toMatchObject({
      canonical: "/",
      languages: { ar: "/", en: "/en", "x-default": "/" },
    });
    expect(meta.openGraph).toMatchObject({
      locale: "ar_EG",
      url: "/",
      title: "Wesal Mosque and Event Hall",
    });
    expect(String(meta.description)).toBe("قاعة للمناسبات");
    expect(meta.openGraph?.images).toEqual([
      { url: "https://wesal.example/api/v1/media/3", alt: "القاعة" },
    ]);
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["https://wesal.example/api/v1/media/3"],
    });
  });

  it("gives English its own canonical and description", () => {
    const meta = homeMetadata({ ...input, locale: "en" });
    expect(meta.alternates).toMatchObject({ canonical: "/en" });
    expect(meta.openGraph).toMatchObject({ locale: "en_GB", url: "/en" });
    expect(String(meta.description)).toBe("A hall for occasions");
    expect(meta.openGraph?.images).toEqual([
      { url: "https://wesal.example/api/v1/media/3", alt: "The hall" },
    ]);
  });

  it("falls back to the venue name and the text-only card without content or a hero", () => {
    const meta = homeMetadata({
      ...input,
      locale: "en",
      descriptionAr: "",
      descriptionEn: "",
      hero: null,
    });
    expect(String(meta.description)).toBe("Wesal Mosque and Event Hall");
    expect(meta.openGraph?.images).toBeUndefined();
    expect(meta.twitter).toMatchObject({ card: "summary" });
  });

  it("falls back to the Arabic alternative text when English is empty", () => {
    const meta = homeMetadata({
      ...input,
      locale: "en",
      hero: { ...input.hero, altEn: "" },
    });
    expect(meta.openGraph?.images).toEqual([
      {
        url: "https://wesal.example/api/v1/media/3",
        alt: "القاعة",
      },
    ]);
  });
});

describe("publicBaseUrl", () => {
  it("prefers PUBLIC_BASE_URL, then the auth URL, then localhost", () => {
    expect(publicBaseUrl({ PUBLIC_BASE_URL: "https://wesal.example/" })).toBe(
      "https://wesal.example",
    );
    expect(publicBaseUrl({ BETTER_AUTH_URL: "https://auth.example" })).toBe(
      "https://auth.example",
    );
    expect(publicBaseUrl({})).toBe("http://localhost:3000");
  });
});
