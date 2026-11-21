// @vitest-environment happy-dom
// SPEC: docs/design/views/calendar.md — slot rows show time, state and only the action that exists; near slots offer call and WhatsApp; an empty day offers the contact fallback
// ROADMAP: phase-3-booking / public-calendar / Implement calendar view: month picker, day slots, state labels, disabled taken slots
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import messages from "../../../messages/en.json";
import type { AvailabilityDay } from "@/lib/calendar-api";
import type { VenueContact } from "@/lib/venue-contact";

import { DayPanel } from "./day-panel";

// The locale-aware Link pulls in next/navigation, which Vitest cannot load
// outside the Next.js runtime. A plain anchor is enough for these assertions.
vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({
      children,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) =>
      createElement("a", props, children),
  };
});

afterEach(cleanup);

const contact: VenueContact = {
  phone: "+201012345678",
  whatsapp: "+201012345678",
};

const day: AvailabilityDay = {
  day: "2026-11-15",
  closed: false,
  slots: [
    { start: "10:00", end: "12:00", state: "confirmed", action: "none" },
    { start: "12:30", end: "15:00", state: "awaiting_review", action: "none" },
    { start: "15:30", end: "18:00", state: "free", action: "call" },
    { start: "18:30", end: "21:00", state: "free", action: "book" },
  ],
};

function renderDay(overrides: Partial<Parameters<typeof DayPanel>[0]> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DayPanel
        day={day.day}
        data={day}
        today="2026-11-15"
        contact={contact}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
}

describe("DayPanel", () => {
  it("lists the day's slots with their states and a free count", () => {
    renderDay();

    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "Sunday, November 15",
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "2 free slots",
    );
    expect(screen.getByText("Confirmed")).toBeTruthy();
    expect(screen.getByText("Awaiting review")).toBeTruthy();
    expect(screen.getByText("Call to book")).toBeTruthy();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("carries date and slot into the booking link, and only on a bookable slot", () => {
    renderDay();

    const book = screen.getByRole("link", {
      name: /Book the 6:30 PM to 9:00 PM slot/,
    });
    const href = book.getAttribute("href") ?? "";
    expect(href).toContain("/book?");
    expect(href).toContain("day=2026-11-15");
    expect(href).toContain("start=18%3A30");
    expect(href).toContain("end=21%3A00");
    expect(href).not.toContain("occasion=");

    expect(
      screen.queryByRole("link", { name: /Book the 10:00 AM/ }),
    ).toBeNull();
  });

  it("carries the landing page's occasion into the booking link", () => {
    renderDay({ occasionId: 2 });

    const book = screen.getByRole("link", {
      name: /Book the 6:30 PM to 9:00 PM slot/,
    });
    expect(book.getAttribute("href")).toContain("occasion=2");
  });

  it("offers the phone and WhatsApp instead of booking inside the cutoff", () => {
    renderDay();

    expect(
      screen
        .getByRole("link", { name: /Call us to book the 3:30 PM slot/ })
        .getAttribute("href"),
    ).toBe("tel:+201012345678");
    expect(
      screen
        .getByRole("link", {
          name: /WhatsApp to book the 3:30 PM slot/,
        })
        .getAttribute("href"),
    ).toBe("https://wa.me/201012345678");
    expect(screen.queryByRole("link", { name: /Book the 3:30 PM/ })).toBeNull();
  });

  it("shows the empty moment with the contact fallback on a closed day", () => {
    renderDay({
      day: "2026-11-20",
      data: { day: "2026-11-20", closed: true, slots: [] },
      today: "2026-11-15",
    });

    expect(
      screen.getByText("The venue is not available on this day"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Call us/ }).getAttribute("href"),
    ).toBe("tel:+201012345678");
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("renders nothing that leads nowhere when no contact is set", () => {
    renderDay({
      day: "2026-11-20",
      data: { day: "2026-11-20", closed: true, slots: [] },
      contact: { phone: null, whatsapp: null },
    });

    expect(screen.queryByRole("link")).toBeNull();
    expect(
      screen.getByText("The venue is not available on this day"),
    ).toBeTruthy();
  });
});
