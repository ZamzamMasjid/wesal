// SPEC: docs/architecture/overview.md — Failure behavior: a static notice shows the venue's phone and WhatsApp
// ROADMAP: phase-1-infrastructure / deployment / Add health endpoint and static fallback notice with venue phone and WhatsApp
import { describe, expect, it } from "vitest";

import { dialable, whatsappUrl } from "./venue-contact";

describe("venue contact links", () => {
  it("strips formatting for tel: links", () => {
    expect(dialable("+20 100 123-4567")).toBe("+201001234567");
  });
  it("builds a wa.me link without the plus sign", () => {
    expect(whatsappUrl("+20 100 123 4567")).toBe("https://wa.me/201001234567");
  });
  it("prefills the chat with a message, safely encoded", () => {
    expect(whatsappUrl("+201001234567", "Booking 7K3M9Q")).toBe(
      "https://wa.me/201001234567?text=Booking%207K3M9Q",
    );
  });
});
