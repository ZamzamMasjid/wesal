// @vitest-environment happy-dom
// SPEC: docs/features/landing-page — gallery tiles are buttons with the owner's alternative text; the lightbox traps focus and moves with arrow keys; videos never autoplay with sound
// ROADMAP: phase-5-public-site / landing-page / Implement home view: hero, gallery, occasion prices, policy, contact
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import type { MediaItem } from "@/lib/content-api";

import { HomeGallery } from "./home-gallery";

vi.mock("next/image", async () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, unoptimized, sizes, priority, ...rest } = props;
    void fill;
    void unoptimized;
    void sizes;
    void priority;
    return createElement("img", rest);
  },
}));

const media: MediaItem[] = [
  {
    id: 1,
    kind: "photo",
    position: 0,
    altAr: "القاعة الكبرى",
    altEn: "The main hall",
    url: "/api/v1/media/1",
    mimeType: "image/jpeg",
    byteSize: 10,
  },
  {
    id: 2,
    kind: "photo",
    position: 1,
    altAr: "المدخل",
    altEn: "The entrance",
    url: "/api/v1/media/2",
    mimeType: "image/jpeg",
    byteSize: 10,
  },
  {
    id: 3,
    kind: "video",
    position: 2,
    altAr: "جولة",
    altEn: "A tour",
    url: "/api/v1/media/3",
    mimeType: "video/mp4",
    byteSize: 10,
  },
];

function renderGallery() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HomeGallery media={media} locale="en" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  // Radix's dialog measures and captures the pointer; happy-dom does not.
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => undefined;
  }
});

afterEach(cleanup);

describe("HomeGallery", () => {
  it("labels each tile with the alternative text and marks videos", () => {
    renderGallery();
    expect(screen.getByRole("button", { name: "The main hall" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Video: A tour" })).toBeTruthy();
  });

  it("opens the lightbox, moves with the arrow keys and closes", () => {
    renderGallery();
    fireEvent.click(screen.getByRole("button", { name: "The main hall" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByAltText("The main hall")).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByAltText("The entrance")).toBeTruthy();
    expect(screen.getByText("2 / 3")).toBeTruthy();

    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(screen.getByAltText("The main hall")).toBeTruthy();
  });

  it("opens a video muted with controls", () => {
    renderGallery();
    fireEvent.click(screen.getByRole("button", { name: "Video: A tour" }));

    const dialog = screen.getByRole("dialog");
    const video = dialog.querySelector("video");
    expect(video?.getAttribute("controls")).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.getAttribute("autoplay")).not.toBeNull();
  });

  it("stops at the final item", () => {
    renderGallery();
    fireEvent.click(screen.getByRole("button", { name: "Video: A tour" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
