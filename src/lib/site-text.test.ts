// SPEC: docs/features/landing-page — English falls back to Arabic; policy rules are one per line; the first photo is the hero; prices use Western digits
// ROADMAP: phase-5-public-site / landing-page / Implement home view: hero, gallery, occasion prices, policy, contact
import { describe, expect, it } from "vitest";

import type { MediaItem } from "./content-api";
import {
  formatPrice,
  heroMedia,
  localized,
  mediaAlternative,
  occasionName,
  paragraphs,
  policyRules,
} from "./site-text";

function media(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 1,
    kind: "photo",
    position: 0,
    altAr: "القاعة",
    altEn: "",
    url: "/api/v1/media/1",
    mimeType: "image/jpeg",
    byteSize: 10,
    ...overrides,
  };
}

describe("localized", () => {
  it("uses Arabic on the Arabic page and falls back for empty English", () => {
    expect(localized("نص", "Text", "ar")).toBe("نص");
    expect(localized("نص", "Text", "en")).toBe("Text");
    expect(localized("نص", "  ", "en")).toBe("نص");
  });
});

describe("policyRules and paragraphs", () => {
  it("keeps one rule per non-empty line and paragraphs on blank lines", () => {
    expect(policyRules("one\n\n two \n")).toEqual(["one", "two"]);
    expect(paragraphs("first\nline\n\nsecond")).toEqual([
      "first\nline",
      "second",
    ]);
    expect(policyRules("   ")).toEqual([]);
  });
});

describe("heroMedia", () => {
  it("uses the first photo, never a video", () => {
    expect(heroMedia([])).toBeNull();
    expect(heroMedia([media({ id: 2, kind: "video" })])).toBeNull();
    expect(
      heroMedia([media({ id: 2, kind: "video" }), media({ id: 3 })]),
    ).toMatchObject({ id: 3 });
  });
});

describe("mediaAlternative and occasionName", () => {
  it("fall back to Arabic when English is empty", () => {
    expect(mediaAlternative(media(), "en")).toBe("القاعة");
    expect(occasionName({ nameAr: "زفاف", nameEn: "" }, "en")).toBe("زفاف");
    expect(occasionName({ nameAr: "زفاف", nameEn: "Wedding" }, "en")).toBe(
      "Wedding",
    );
  });
});

describe("formatPrice", () => {
  it("groups Western digits with no decimals", () => {
    expect(formatPrice(15000)).toBe("15,000");
    expect(formatPrice(2000)).toBe("2,000");
  });
});
