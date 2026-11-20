// @vitest-environment happy-dom
// SPEC: docs/design/views/booking-status.md — transfer details only while payable, the countdown runs from the server deadline, a change is announced, and a failed refresh keeps the last status
// ROADMAP: phase-3-booking / booking-page / Implement booking-status view: transfer details, deposit, countdown, status
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
import type { PublicBooking } from "@/lib/booking-read-api";

import { BookingStatus } from "./booking-status";

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

const held: PublicBooking = {
  bookingId: "7K3M9Q",
  status: "held",
  occasion: { nameAr: "زفاف", nameEn: "Wedding" },
  customerName: "Mona Hassan",
  day: "2026-12-25",
  start: "18:00",
  end: "20:00",
  priceEgp: 10_000,
  depositEgp: 2_500,
  remainderEgp: 7_500,
  remainderPaid: false,
  deadlineAt: "2026-12-25T16:20:00.000Z",
  transfer: {
    vodafoneCashNumber: "01001234567",
    instapayAddress: "name@instapay",
  },
  createdAt: "2026-12-25T16:00:00.000Z",
  refreshedAt: "2026-12-25T16:00:00.000Z",
};

const response = (data: PublicBooking) => ({
  json: async () => ({ ok: true, data }),
});

function renderStatus(
  initial: PublicBooking = held,
  fetchMock: ReturnType<typeof vi.fn> = vi.fn(async () => response(initial)),
) {
  vi.stubGlobal("fetch", fetchMock);
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BookingStatus token="token-seven" initial={initial} />
    </NextIntlClientProvider>,
  );
  return fetchMock;
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

describe("BookingStatus", () => {
  it("shows the deposit, both transfer details and the server's countdown", () => {
    renderStatus();

    expect(screen.getByText("Awaiting payment")).toBeTruthy();
    expect(screen.getByText("EGP 2,500")).toBeTruthy();
    expect(screen.getByText("01001234567")).toBeTruthy();
    expect(screen.getByText("name@instapay")).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("20:00");
    expect(screen.getByText("7K3M9Q")).toBeTruthy();
    expect(screen.getByText("Wedding")).toBeTruthy();
    expect(screen.getByText("Friday, December 25")).toBeTruthy();
  });

  it("never leaks the customer's phone number", () => {
    renderStatus();
    expect(document.body.textContent).not.toContain("+201001234567");
  });

  it("warns under five minutes with text, not only color", () => {
    renderStatus({
      ...held,
      deadlineAt: "2026-12-25T16:20:00.000Z",
      refreshedAt: "2026-12-25T16:15:01.000Z",
    });

    expect(screen.getByRole("timer").textContent).toBe("4:59");
    expect(screen.getByText("Less than 5 minutes left.")).toBeTruthy();
  });

  it("counts down to expiry and offers to book again", async () => {
    vi.useFakeTimers();
    renderStatus({
      ...held,
      deadlineAt: "2026-12-25T16:00:02.000Z",
      refreshedAt: "2026-12-25T16:00:00.000Z",
    });

    expect(screen.getByRole("timer").textContent).toBe("0:02");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(screen.getByText("Expired")).toBeTruthy();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText("01001234567")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Book again" }).getAttribute("href"),
    ).toBe("/calendar");
  });

  it("keeps transfer details hidden once proof is in", () => {
    renderStatus({
      ...held,
      status: "proof_submitted",
      deadlineAt: null,
      transfer: null,
    });

    expect(screen.getByText("Awaiting review")).toBeTruthy();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText("01001234567")).toBeNull();
    expect(
      screen.getByText(
        "We received your proof. The venue will confirm shortly.",
      ),
    ).toBeTruthy();
  });

  it("shows the balance due at the venue on a confirmed booking", () => {
    renderStatus({ ...held, status: "confirmed", deadlineAt: null });

    expect(screen.getByText("Your booking is confirmed")).toBeTruthy();
    expect(screen.getByText("EGP 7,500")).toBeTruthy();
  });

  it("refreshes on focus and announces a changed status assertively", async () => {
    const confirmed = {
      ...held,
      status: "confirmed" as const,
      deadlineAt: null,
    };
    const fetchMock = renderStatus(
      { ...held, status: "proof_submitted", deadlineAt: null },
      vi.fn(async () => response(confirmed)),
    );

    fireEvent.focus(window);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Your booking is confirmed")).toBeTruthy();
    expect(await screen.findByText("Booking status: Confirmed")).toBeTruthy();
  });

  it("refreshes every 30 seconds while the tab is visible", async () => {
    vi.useFakeTimers();
    const fetchMock = renderStatus();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the last known status when a refresh fails and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ ok: false }) })
      .mockResolvedValueOnce(
        response({ ...held, status: "confirmed", deadlineAt: null }),
      );
    renderStatus(held, fetchMock);

    fireEvent.focus(window);

    expect(
      await screen.findByText(
        "This page is not live right now. The last known status is shown.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Awaiting payment")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Your booking is confirmed")).toBeTruthy();
    expect(
      screen.queryByText(
        "This page is not live right now. The last known status is shown.",
      ),
    ).toBeNull();
  });
});
