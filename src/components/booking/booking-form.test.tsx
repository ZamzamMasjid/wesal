// @vitest-environment happy-dom
// SPEC: docs/design/views/booking-form.md — the occasion updates the deposit, a missing detail is refused inline, and a taken slot replaces the form with the conflict panel
// ROADMAP: phase-3-booking / booking-hold / Implement booking-form view: occasion, name, phone, conflict message
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import messages from "../../../messages/en.json";
import { createHold, type HoldCreated } from "@/lib/booking-api";

import { BookingForm } from "./booking-form";

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

vi.mock("@/lib/booking-api", () => ({
  createHold: vi.fn(),
}));

// The real code step owns the six-digit input and resend timer, which its own
// test covers. Here it only has to report a verified phone.
vi.mock("./code-step", async () => {
  const { createElement } = await import("react");
  return {
    CodeStep: ({
      onVerified,
      onChangeNumber,
    }: {
      onVerified: (result: { token: string; phone: string }) => void;
      onChangeNumber: () => void;
    }) =>
      createElement(
        "div",
        null,
        createElement("p", null, "code step"),
        createElement(
          "button",
          {
            type: "button",
            onClick: () =>
              onVerified({ token: "v1.token", phone: "+201001234567" }),
          },
          "Verify",
        ),
        createElement(
          "button",
          { type: "button", onClick: onChangeNumber },
          "Change number",
        ),
      ),
  };
});

const occasions = [
  { id: 1, nameAr: "زفاف", nameEn: "Wedding", priceEgp: 10_000 },
  { id: 2, nameAr: "عزاء", nameEn: "Funeral", priceEgp: 2_000 },
];

const held: HoldCreated = {
  bookingId: "ABC234",
  linkToken: "link-token",
  deadlineAt: "2026-12-25T16:20:00.000Z",
  priceEgp: 10_000,
  depositEgp: 5_000,
  urgent: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderForm() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BookingForm
        day="2026-12-25"
        start="18:00"
        end="20:00"
        occasions={occasions}
        depositPercent={50}
        holdMinutes={20}
      />
    </NextIntlClientProvider>,
  );
}

function fillDetails() {
  fireEvent.change(screen.getByLabelText(/Your name/), {
    target: { value: "Mona" },
  });
  fireEvent.change(screen.getByLabelText(/Phone/), {
    target: { value: "01001234567" },
  });
  fireEvent.click(screen.getByRole("radio", { name: /Wedding/ }));
  fireEvent.click(screen.getByRole("button", { name: "Book now" }));
}

describe("BookingForm", () => {
  it("shows the slot, its occasions and the deposit for the chosen one", () => {
    renderForm();

    expect(screen.getByText("Friday, December 25")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Wedding/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Funeral/ })).toBeTruthy();
    expect(
      screen.getByText("Choose an occasion to see the deposit."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /Wedding/ }));

    expect(
      screen.queryByText("Choose an occasion to see the deposit."),
    ).toBeNull();
    expect(screen.getByText(/5,000/)).toBeTruthy();
  });

  it("refuses an empty name, phone or occasion inline", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Book now" }));

    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(screen.getByText("Enter a valid phone number.")).toBeTruthy();
    expect(screen.getByText("Choose an occasion.")).toBeTruthy();
    expect(screen.queryByText("code step")).toBeNull();
  });

  it("moves to the code step and opens the booking once the hold exists", async () => {
    vi.mocked(createHold).mockResolvedValue({ ok: true, data: held });
    renderForm();
    fillDetails();

    expect(screen.getByText("code step")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText("Your slot is held")).toBeTruthy();
    expect(createHold).toHaveBeenCalledWith({
      day: "2026-12-25",
      start: "18:00",
      end: "20:00",
      occasionId: 1,
      name: "Mona",
      phone: "01001234567",
      token: "v1.token",
      locale: "en",
    });
    expect(screen.getByText("Booking number: ABC234")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Open your booking" })
        .getAttribute("href"),
    ).toBe("/booking/link-token");
  });

  it("replaces the form with the conflict panel when the slot is taken", async () => {
    vi.mocked(createHold).mockResolvedValue({
      ok: false,
      error: { code: "SLOT_TAKEN" },
    });
    renderForm();
    fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() =>
      expect(screen.getByText("This slot is not available")).toBeTruthy(),
    );
    expect(
      screen.getByText(/currently being booked by another customer/),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Choose another slot" })
        .getAttribute("href"),
    ).toBe("/calendar?day=2026-12-25");
  });

  it("names the existing booking when the phone already has a hold", async () => {
    vi.mocked(createHold).mockResolvedValue({
      ok: false,
      error: { code: "PHONE_HOLD_EXISTS", details: { bookingId: "OLD234" } },
    });
    renderForm();
    fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => expect(screen.getByText(/OLD234/)).toBeTruthy());
  });

  it("returns to the details with the contents kept", () => {
    renderForm();
    fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Change number" }));

    expect(screen.getByLabelText(/Your name/)).toHaveProperty("value", "Mona");
    expect(screen.getByLabelText(/Phone/)).toHaveProperty(
      "value",
      "01001234567",
    );
    expect(
      (screen.getByRole("radio", { name: /Wedding/ }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
});
