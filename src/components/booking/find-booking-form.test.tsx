// @vitest-environment happy-dom
// SPEC: docs/features/booking-page — a typed booking ID is normalized, opens the link, and wrong, empty and rate-limited answers each get one message
// ROADMAP: phase-3-booking / booking-page / Implement find-my-booking form by booking ID
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";

import { FindBookingForm } from "./find-booking-form";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}));

const answer = (body: unknown) => ({ json: async () => body });

function renderForm(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FindBookingForm />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("textbox", { name: "Booking number" });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockReset();
});

describe("FindBookingForm", () => {
  it("normalizes the typed ID and opens the booking link", async () => {
    const fetchMock = vi.fn(async () =>
      answer({
        ok: true,
        data: { bookingId: "7K3M9Q", token: "token-seven" },
      }),
    );
    const input = renderForm(fetchMock);

    fireEvent.change(input, { target: { value: " 7k3-m9q " } });
    fireEvent.click(screen.getByRole("button", { name: /Open my booking/ }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/booking/token-seven"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/bookings/lookup?bookingId=7K3M9Q",
      expect.anything(),
    );
  });

  it("accepts Arabic-Indic digits", async () => {
    const fetchMock = vi.fn(async () =>
      answer({ ok: true, data: { bookingId: "123456", token: "t" } }),
    );
    const input = renderForm(fetchMock);

    fireEvent.change(input, { target: { value: "١٢٣٤٥٦" } });
    fireEvent.click(screen.getByRole("button", { name: /Open my booking/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/bookings/lookup?bookingId=123456",
        expect.anything(),
      ),
    );
  });

  it("shows one not-found message for an unknown ID", async () => {
    renderForm(
      vi.fn(async () => answer({ ok: false, error: { code: "NOT_FOUND" } })),
    );
    const input = screen.getByRole("textbox", { name: "Booking number" });

    fireEvent.change(input, { target: { value: "AAAAAA" } });
    fireEvent.click(screen.getByRole("button", { name: /Open my booking/ }));

    expect(
      await screen.findByText("We could not find a booking with that number."),
    ).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("does not ask the server about an empty ID", () => {
    const fetchMock = vi.fn();
    renderForm(fetchMock);

    fireEvent.click(screen.getByRole("button", { name: /Open my booking/ }));

    expect(
      screen.getByText("We could not find a booking with that number."),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says how long to wait when the lookup is rate-limited", async () => {
    renderForm(
      vi.fn(async () =>
        answer({
          ok: false,
          error: { code: "RATE_LIMITED", details: { retryAfterSeconds: 42 } },
        }),
      ),
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Booking number" }), {
      target: { value: "7K3M9Q" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Open my booking/ }));

    expect(
      await screen.findByText("Too many tries. Wait 42 seconds and try again."),
    ).toBeTruthy();
  });
});
