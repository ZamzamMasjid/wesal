// @vitest-environment happy-dom
// SPEC: docs/features/staff-notifications — each staff member has a notification phone, can turn alerts on or off, and picks the language alerts are written in
// ROADMAP: phase-4-operations / staff-notifications / Implement per-staff notification phone and opt-in setting
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";

import { MyNotifications, type StaffProfile } from "./notifications";

const profile: StaffProfile = {
  id: "staff-1",
  name: "Sara",
  role: "staff",
  notifyPhone: "+201001234567",
  notifyEnabled: true,
  alertChannel: "whatsapp",
  locale: "ar",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderCard(overrides: Partial<StaffProfile> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MyNotifications initial={{ ...profile, ...overrides }} />
    </NextIntlClientProvider>,
  );
}

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

describe("MyNotifications", () => {
  it("shows the current phone, opt-in and language", () => {
    renderCard();
    expect(screen.getByLabelText("Alert phone")).toHaveProperty(
      "value",
      "+201001234567",
    );
    expect(screen.getByLabelText("Send me alerts")).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByLabelText("Message language")).toHaveProperty(
      "value",
      "ar",
    );
    expect(screen.getByLabelText("How to alert me")).toHaveProperty(
      "value",
      "whatsapp",
    );
  });

  it("warns an owner who has no alert phone", () => {
    renderCard({ role: "owner", notifyPhone: null });
    expect(screen.getByText(/No alert phone is set for you/)).toBeDefined();
  });

  it("saves the phone, opt-in and language", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: {
          ...profile,
          notifyPhone: "+201009876543",
          notifyEnabled: false,
          locale: "en",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderCard();

    fireEvent.change(screen.getByLabelText("Alert phone"), {
      target: { value: "+201009876543" },
    });
    fireEvent.click(screen.getByLabelText("Send me alerts"));
    fireEvent.change(screen.getByLabelText("Message language"), {
      target: { value: "en" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Alert settings saved.")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/staff/me/notifications",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          notifyPhone: "+201009876543",
          notifyEnabled: false,
          alertChannel: "whatsapp",
          locale: "en",
        }),
      }),
    );
  });

  it("clears the phone when the field is empty", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        data: { ...profile, notifyPhone: null },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderCard();

    fireEvent.change(screen.getByLabelText("Alert phone"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Alert settings saved.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/staff/me/notifications",
      expect.objectContaining({
        body: JSON.stringify({
          notifyPhone: null,
          notifyEnabled: true,
          alertChannel: "whatsapp",
          locale: "ar",
        }),
      }),
    );
  });

  it("reports a rejected phone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: false,
          error: { code: "VALIDATION_FAILED" },
        }),
      ),
    );
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Enter a valid phone number."),
    ).toBeDefined();
  });
});
