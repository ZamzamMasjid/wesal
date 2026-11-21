// @vitest-environment happy-dom
// SPEC: docs/design/views/review-queue.md — urgent items first, the wait is shown, and the empty state is calm
// ROADMAP: phase-4-operations / payment-review / Implement review-queue view with screenshot viewer and confirm/reject actions
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import messages from "../../../messages/en.json";
import type { ReviewQueue as ReviewQueueData } from "@/lib/review-api";

import { ReviewQueue } from "./review-queue";

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

const NOW = "2026-12-20T08:00:00.000Z";

function anItem(overrides: Partial<ReviewQueueData["items"][number]> = {}) {
  return {
    id: 1,
    bookingId: "ABC234",
    status: "proof_submitted" as const,
    urgent: false,
    occasion: { nameAr: "زفاف", nameEn: "Wedding" },
    customerName: "Mona",
    customerPhone: "+201001234567",
    day: "2026-12-25",
    start: "18:00",
    end: "20:00",
    priceEgp: 5000,
    depositEgp: 2500,
    waitingSince: "2026-12-20T07:00:00.000Z",
    deadlineAt: null,
    proof: {
      id: 9,
      receivedVia: "upload" as const,
      uploadedAt: "2026-12-20T07:00:00.000Z",
      purgedAt: null,
    },
    proofCount: 1,
    ...overrides,
  };
}

function renderQueue(items: ReviewQueueData["items"]) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReviewQueue initial={{ items, refreshedAt: NOW }} />
    </NextIntlClientProvider>,
  );
}

describe("ReviewQueue", () => {
  it("lists each payment with its deposit, wait and a link to its review page", () => {
    renderQueue([anItem()]);

    expect(screen.getByRole("status").textContent).toContain("1 payment");
    expect(screen.getByText("Wedding")).toBeTruthy();
    expect(screen.getByText("Mona")).toBeTruthy();
    expect(screen.getByText("EGP 2,500")).toBeTruthy();
    expect(screen.getByText("waiting 1 hour")).toBeTruthy();

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/dashboard/review/ABC234");
  });

  it("puts urgent items first and says so in text, not colour alone", () => {
    renderQueue([
      anItem({ id: 1, bookingId: "NORMAL1" }),
      anItem({ id: 2, bookingId: "URGENT1", urgent: true }),
    ]);

    expect(screen.getByText("Urgent")).toBeTruthy();
    const labels = screen
      .getAllByRole("link")
      .map((link) => link.textContent ?? "");
    expect(labels[0]).toContain("Urgent");
  });

  it("shows a calm empty state when nothing is waiting", () => {
    renderQueue([]);
    expect(screen.getByText("No payments to review")).toBeTruthy();
    expect(screen.getByText("Nothing waiting")).toBeTruthy();
  });
});
