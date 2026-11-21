// @vitest-environment happy-dom
// SPEC: docs/features/content-management — the owner edits both languages, saves explicitly, reorders media with move buttons, and sees type errors before upload
// ROADMAP: phase-5-public-site / content-management / Implement owner-only content editor screens
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import {
  deleteMedia,
  fetchMediaLibrary,
  fetchStaffContent,
  saveSiteContent,
  updateMedia,
  type MediaItem,
  type SiteTexts,
} from "@/lib/content-api";

import { ContentManager } from "./content-manager";

vi.mock("@/lib/content-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content-api")>();
  return {
    ...actual,
    fetchStaffContent: vi.fn(),
    fetchMediaLibrary: vi.fn(),
    saveSiteContent: vi.fn(),
    updateMedia: vi.fn(),
    deleteMedia: vi.fn(),
    uploadMedia: vi.fn(),
  };
});

const contentMock = vi.mocked(fetchStaffContent);
const libraryMock = vi.mocked(fetchMediaLibrary);
const saveMock = vi.mocked(saveSiteContent);
const updateMock = vi.mocked(updateMedia);
const deleteMock = vi.mocked(deleteMedia);

const texts: SiteTexts = {
  descriptionAr: "قاعة قديمة",
  descriptionEn: "An old hall",
  policyAr: "ادفع العربون",
  policyEn: "Pay the deposit",
  contactPhone: "01012345678",
  contactWhatsapp: "01098765432",
};

function media(id: number, position: number, altEn: string): MediaItem {
  return {
    id,
    kind: "photo",
    position,
    altAr: `صورة ${id}`,
    altEn,
    url: `/api/v1/media/${id}`,
    mimeType: "image/jpeg",
    byteSize: 1024,
  };
}

const library = {
  media: [media(1, 0, "Hall"), media(2, 1, "Entrance")],
  limits: { maxPhotoMb: 20, maxVideoMb: 200 },
  disk: {
    totalBytes: 100 * 1024 * 1024,
    usedBytes: 25 * 1024 * 1024,
    freeBytes: 75 * 1024 * 1024,
  },
};

function renderManager() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContentManager />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  contentMock.mockReset();
  libraryMock.mockReset();
  saveMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  contentMock.mockResolvedValue({
    ok: true,
    data: { content: texts, media: library.media },
  });
  libraryMock.mockResolvedValue({ ok: true, data: library });
  updateMock.mockResolvedValue({
    ok: true,
    data: { ...library.media[0]!, position: 1 },
  });
  deleteMock.mockResolvedValue({ ok: true, data: { id: 1 } });
});

afterEach(cleanup);

describe("ContentManager", () => {
  it("loads both languages and saves edited text through the save bar", async () => {
    saveMock.mockResolvedValue({
      ok: true,
      data: { content: { ...texts, descriptionEn: "A new hall" }, media: [] },
    });
    renderManager();

    const english = await screen.findByRole("textbox", {
      name: /Description — English/i,
    });
    fireEvent.change(english, { target: { value: "A new hall" } });
    expect(screen.getByText("You have unsaved text changes.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save content" }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock.mock.calls[0]![0]).toMatchObject({
      descriptionEn: "A new hall",
      descriptionAr: "قاعة قديمة",
    });
    expect(
      await screen.findByText("Content saved and published."),
    ).toBeTruthy();
  });

  it("shows the Arabic fallback hint when English is empty", async () => {
    contentMock.mockResolvedValue({
      ok: true,
      data: {
        content: { ...texts, descriptionEn: "", policyEn: "" },
        media: [],
      },
    });
    renderManager();
    expect(
      await screen.findAllByText(
        "Left empty, the English page shows the Arabic text.",
      ),
    ).toHaveLength(2);
  });

  it("reorders media with the move buttons and persists the new positions", async () => {
    renderManager();
    await screen.findByRole("button", { name: "Move Hall later" });

    fireEvent.click(screen.getByRole("button", { name: "Move Hall later" }));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(2, { position: 0 }),
    );
    expect(updateMock).toHaveBeenCalledWith(1, { position: 1 });
  });

  it("refuses a text file before sending it and names the reason", async () => {
    renderManager();
    await screen.findByRole("button", { name: "Move Hall later" });

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array([1])], "notes.txt", { type: "text/plain" }),
        ],
      },
    });

    expect((await screen.findByRole("alert")).textContent).toContain(
      "notes.txt is not a photo or a video.",
    );
  });

  it("asks before deleting and removes the item when confirmed", async () => {
    const original = window.confirm;
    const confirm = vi.fn(() => true);
    window.confirm = confirm;
    renderManager();
    await screen.findByRole("button", { name: "Move Hall later" });

    fireEvent.click(screen.getByRole("button", { name: "Delete Hall" }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));
    expect(confirm).toHaveBeenCalled();
    window.confirm = original;
  });

  it("shows a retry when the content cannot be loaded", async () => {
    contentMock.mockResolvedValue({ ok: false, error: { code: "INTERNAL" } });
    renderManager();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not load the content.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
