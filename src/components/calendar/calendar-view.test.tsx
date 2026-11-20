// @vitest-environment happy-dom
// SPEC: docs/features/public-calendar — states refresh every 30 seconds and on focus, a background failure keeps the previous states, and a failed first load offers Retry
// ROADMAP: phase-3-booking / public-calendar / Add 30-second and on-focus refresh of slot states
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import messages from "../../../messages/en.json";
import type { Availability } from "@/lib/calendar-api";

import { CalendarView } from "./calendar-view";

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

const initial: Availability = {
  from: "2026-11-01",
  to: "2026-11-30",
  today: "2026-11-15",
  refreshedAt: "2026-11-15T08:00:00.000Z",
  days: [
    {
      day: "2026-11-15",
      closed: false,
      slots: [{ start: "18:30", end: "21:00", state: "free", action: "book" }],
    },
    {
      day: "2026-11-16",
      closed: false,
      slots: [{ start: "18:30", end: "21:00", state: "free", action: "book" }],
    },
  ],
};

const taken: Availability = {
  ...initial,
  refreshedAt: "2026-11-15T08:00:30.000Z",
  days: [
    {
      day: "2026-11-15",
      closed: false,
      slots: [
        { start: "18:30", end: "21:00", state: "confirmed", action: "none" },
      ],
    },
    initial.days[1]!,
  ],
};

const december: Availability = {
  from: "2026-12-01",
  to: "2026-12-31",
  today: "2026-11-15",
  refreshedAt: "2026-11-15T08:01:00.000Z",
  days: [{ day: "2026-12-01", closed: false, slots: [] }],
};

const response = (data: Availability) => ({
  json: async () => ({ ok: true, data }),
});

function renderView(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CalendarView initial={initial} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CalendarView", () => {
  it("renders the server's month with today selected and makes no immediate request", () => {
    const fetchMock = vi.fn(async () => response(taken));
    renderView(fetchMock);

    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(
      document.getElementById("calendar-day-heading")?.textContent,
    ).toContain("Sunday, November 15");
    expect(screen.getByText("Updated just now")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves focus to the day heading when another day is selected", () => {
    const fetchMock = vi.fn(async () => response(taken));
    renderView(fetchMock);

    fireEvent.click(
      screen.getByRole("button", {
        name: /November 16, 2026, has free slots/,
      }),
    );

    const heading = document.getElementById("calendar-day-heading");
    expect(heading?.textContent).toContain("Monday, November 16");
    expect(document.activeElement).toBe(heading);
  });

  it("refreshes on focus and announces a changed slot politely", async () => {
    const fetchMock = vi.fn(async () => response(taken));
    renderView(fetchMock);

    fireEvent.focus(window);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("6:30 PM: now Confirmed")).toBeTruthy();
    expect(screen.getAllByText("Confirmed")).toHaveLength(2);
    // The previous states stay on screen; nothing flashes empty.
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Book the 6:30 PM/ })).toBeNull();
  });

  it("refreshes every 30 seconds while the tab is visible", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => response(taken));
    renderView(fetchMock);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Confirmed")).toHaveLength(2);
  });

  it("replaces the cards on a failed month load and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ ok: false }) })
      .mockResolvedValueOnce(response(december));
    renderView(fetchMock);

    fireEvent.click(
      screen.getByRole("button", { name: /Next month: December 2026/ }),
    );

    expect(await screen.findByText("We couldn't load the times")).toBeTruthy();
    expect(screen.queryByText("Slot states")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("December 2026")).toBeTruthy();
    expect(screen.queryByText("We couldn't load the times")).toBeNull();
  });
});
