// @vitest-environment happy-dom
// SPEC: docs/features/payment-review — confirm and reject are single confirmed actions; a WhatsApp proof can be marked received and confirmed in one step
// ROADMAP: phase-4-operations / payment-review / Implement mark-proof-received for screenshots sent over WhatsApp
import {
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
import type { ReviewDetail } from "@/lib/review-api";

import { ReviewDetailView } from "./review-detail";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({
      children,
      ...props
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode }) =>
      createElement("a", props, children),
    useRouter: () => ({ replace, refresh, push: vi.fn() }),
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const detail: ReviewDetail = {
  id: 7,
  bookingId: "ABC234",
  status: "proof_submitted",
  urgent: false,
  occasion: { nameAr: "زفاف", nameEn: "Wedding" },
  customerName: "Mona",
  customerPhone: "+201001234567",
  day: "2026-12-25",
  start: "18:00",
  end: "20:00",
  priceEgp: 5000,
  depositEgp: 2500,
  remainderEgp: 2500,
  createdAt: "2026-12-20T07:00:00.000Z",
  deadlineAt: null,
  proofs: [
    {
      id: 9,
      receivedVia: "upload",
      uploadedAt: "2026-12-20T07:00:00.000Z",
      purgedAt: null,
    },
  ],
};

function renderDetail(overrides: Partial<ReviewDetail> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewDetailView initial={{ ...detail, ...overrides }} />
    </NextIntlClientProvider>,
  );
}

function jsonResponse(body: unknown): Response {
  return {
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
});

describe("ReviewDetailView", () => {
  it("shows the expected deposit first, the screenshot, and one decision at a time", () => {
    renderDetail();

    expect(screen.getByText("Expected deposit")).toBeTruthy();
    expect(screen.getAllByText("EGP 2,500").length).toBeGreaterThan(0);
    expect(
      screen
        .getByAltText("Payment screenshot for booking ABC234")
        .getAttribute("src"),
    ).toBe("/api/v1/staff/proofs/9/file");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
  });

  it("confirms after one dialog and opens the next item, or the empty queue", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: { bookingId: "ABC234", status: "confirmed" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: { items: [], refreshedAt: "2026-12-20T08:00:00.000Z" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm booking" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/v1/staff/bookings/ABC234/confirm",
    );
    expect(replace).toHaveBeenCalledWith("/dashboard/review");
  });

  it("rejects with a reason and a note", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: { bookingId: "ABC234", status: "rejected" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: { items: [], refreshedAt: "2026-12-20T08:00:00.000Z" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(await screen.findByLabelText("No transfer found"));
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "Nothing in the wallet" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject booking" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/staff/bookings/ABC234/reject");
    expect(JSON.parse(String(init.body))).toEqual({
      reason: "no_transfer",
      note: "Nothing in the wallet",
    });
  });

  it("marks a WhatsApp screenshot received and can confirm it in the same step", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: { bookingId: "HELD34", status: "confirmed", proofId: 10 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          data: { items: [], refreshedAt: "2026-12-20T08:00:00.000Z" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderDetail({
      bookingId: "HELD34",
      status: "held",
      proofs: [],
      deadlineAt: "2026-12-20T08:20:00.000Z",
    });

    expect(screen.getByText("No screenshot uploaded")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("And confirm the booking now"));
    fireEvent.click(screen.getByRole("button", { name: "Mark received" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/staff/bookings/HELD34/proof-received");
    expect(JSON.parse(String(init.body))).toEqual({ confirm: true });
    expect(replace).toHaveBeenCalledWith("/dashboard/review");
  });
});
