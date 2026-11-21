// SPEC: docs/features/content-management — English alt text falls back to Arabic; uploads are checked for type and size before sending; ordering is persisted
// ROADMAP: phase-5-public-site / content-management / Implement owner-only content editor screens
import { describe, expect, it } from "vitest";

import {
  contentEntries,
  formatBytes,
  mediaAlt,
  moveMedia,
  positionChanges,
  uploadProblem,
  type MediaItem,
  type SiteTexts,
} from "./content-api";

const texts: SiteTexts = {
  descriptionAr: "قاعة",
  descriptionEn: "Hall",
  policyAr: "سياسة",
  policyEn: "",
  contactPhone: "01012345678",
  contactWhatsapp: "01098765432",
};

function item(overrides: Partial<MediaItem> = {}): MediaItem {
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

describe("contentEntries", () => {
  it("sends every key and writes a contact number once", () => {
    const entries = contentEntries(texts);
    expect(entries.map((entry) => entry.key)).toEqual([
      "description",
      "policy",
      "contact_phone",
      "contact_whatsapp",
    ]);
    expect(entries[2]).toEqual({
      key: "contact_phone",
      valueAr: "01012345678",
      valueEn: "01012345678",
    });
  });
});

describe("mediaAlt", () => {
  it("falls back to Arabic when English is empty", () => {
    expect(mediaAlt(item(), "en")).toBe("القاعة");
    expect(mediaAlt(item({ altEn: "The hall" }), "en")).toBe("The hall");
    expect(mediaAlt(item({ altEn: "The hall" }), "ar")).toBe("القاعة");
  });
});

describe("ordering", () => {
  const media = [
    item({ id: 1, position: 0 }),
    item({ id: 2, position: 1 }),
    item({ id: 3, position: 2 }),
  ];

  it("moves within the list and refuses to move past either end", () => {
    expect(moveMedia(media, 1, 1).map((entry) => entry.id)).toEqual([2, 1, 3]);
    expect(moveMedia(media, 3, -2).map((entry) => entry.id)).toEqual([3, 1, 2]);
    expect(moveMedia(media, 1, -1)).toBe(media);
    expect(moveMedia(media, 3, 1)).toBe(media);
    expect(moveMedia(media, 99, 1)).toBe(media);
  });

  it("reports only the rows whose position changed", () => {
    const moved = moveMedia(media, 1, 1);
    const changes = positionChanges(media, moved);
    expect(changes).toEqual([
      { id: 2, position: 0 },
      { id: 1, position: 1 },
    ]);
    expect(positionChanges(media, media)).toEqual([]);
  });
});

describe("uploadProblem", () => {
  const limits = { maxPhotoMb: 2, maxVideoMb: 10 };

  it("accepts a photo and a video within their limits", () => {
    expect(
      uploadProblem(
        { type: "image/jpeg", name: "a.jpg", size: 2 * 1024 * 1024 },
        limits,
      ),
    ).toBeNull();
    expect(
      uploadProblem(
        { type: "", name: "tour.mp4", size: 9 * 1024 * 1024 },
        limits,
      ),
    ).toBeNull();
  });

  it("refuses an unknown type and a file past its kind's limit", () => {
    expect(
      uploadProblem({ type: "text/plain", name: "a.txt", size: 10 }, limits),
    ).toBe("wrongType");
    expect(
      uploadProblem(
        { type: "image/png", name: "a.png", size: 2 * 1024 * 1024 + 1 },
        limits,
      ),
    ).toBe("tooLarge");
    expect(
      uploadProblem(
        { type: "video/mp4", name: "a.mp4", size: 10 * 1024 * 1024 + 1 },
        limits,
      ),
    ).toBe("tooLarge");
  });
});

describe("formatBytes", () => {
  it("uses a sensible unit in each language", () => {
    expect(formatBytes(1024, "en")).toBe("1 KB");
    expect(formatBytes(5 * 1024 * 1024, "en")).toBe("5 MB");
    expect(formatBytes(0, "ar")).toContain("بايت");
  });
});
