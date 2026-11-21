// @vitest-environment happy-dom
// SPEC: booking-reports/spec.md — figures for a period, by occasion and by month, with an export and links into the filtered bookings list
// ROADMAP: phase-6-alerts-and-reports / booking-reports / Implement reports view with period filter and export
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
import type { ReportsSummary } from "@/lib/reports-api";
import type { ReportPeriod } from "@/lib/reports-period";

import { ReportsView } from "./reports-view";

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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const initial: ReportsSummary = {
  from: "2026-11-01",
  to: "2026-11-30",
  generatedAt: "2026-11-21T08:00:00.000Z",
  bookings: 14,
  incomeEgp: 92000,
  depositEgp: 23000,
  remainderPaidEgp: 18000,
  remainderOutstandingEgp: 12000,
  byOccasion: [
    {
      occasionId: 1,
      nameAr: "زواج",
      nameEn: "Wedding",
      bookings: 6,
      incomeEgp: 60000,
    },
    {
      occasionId: 2,
      nameAr: "خطوبة",
      nameEn: "Engagement",
      bookings: 3,
      incomeEgp: 15000,
    },
  ],
  byMonth: [{ month: "2026-11", bookings: 14, incomeEgp: 92000 }],
  bySource: { online: 9, staff: 5 },
  cancelled: 2,
  expired: 7,
  rejected: 1,
};

const period: ReportPeriod = { kind: "month", month: "2026-11" };

function renderReports(data: ReportsSummary = initial) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReportsView initial={data} initialPeriod={period} />
    </NextIntlClientProvider>,
  );
}

describe("ReportsView", () => {
  it("shows the period's tiles, occasion chart and table", () => {
    renderReports();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Reports",
    );
    expect(screen.getByText("Confirmed bookings")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Bookings by occasion" }),
    ).toBeTruthy();
    expect(screen.getByText("Online 9, entered by staff 5")).toBeTruthy();
    expect(screen.getByText("7 expired holds, 1 rejected proofs")).toBeTruthy();
    expect(screen.getByText(/2 cancelled bookings/)).toBeTruthy();

    const wedding = screen.getByRole("link", { name: "Wedding" });
    expect(wedding.getAttribute("href")).toBe(
      "/dashboard/bookings?from=2026-11-01&to=2026-11-30&occasionId=1",
    );
  });

  it("exports the loaded period", () => {
    renderReports();

    expect(
      screen.getByRole("link", { name: /Export/ }).getAttribute("href"),
    ).toBe("/api/v1/staff/reports/export?from=2026-11-01&to=2026-11-30");
  });

  it("replaces the charts with a message when the period has no bookings", () => {
    renderReports({
      ...initial,
      bookings: 0,
      incomeEgp: 0,
      depositEgp: 0,
      remainderPaidEgp: 0,
      remainderOutstandingEgp: 0,
      byOccasion: [],
      byMonth: [{ month: "2026-11", bookings: 0, incomeEgp: 0 }],
      bySource: { online: 0, staff: 0 },
      cancelled: 0,
      expired: 0,
      rejected: 0,
    });

    expect(screen.getByText("No bookings in this period")).toBeTruthy();
    expect(screen.queryByText("Bookings by occasion")).toBeNull();
  });

  it("reloads every figure when the period moves", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(
        JSON.stringify({
          ok: true,
          data: { ...initial, from: "2026-12-01", to: "2026-12-31" },
        }),
        { headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    renderReports();

    fireEvent.click(screen.getByRole("button", { name: "Next period" }));

    expect(await screen.findByText("December 2026")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/staff/reports/summary?from=2026-12-01&to=2026-12-31",
    );
  });

  it("switches to a custom range and a year", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response(JSON.stringify({ ok: true, data: initial }), {
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderReports();

    fireEvent.click(screen.getByRole("button", { name: "Range" }));
    expect(await screen.findByLabelText("From")).toBeTruthy();
    expect(screen.getByLabelText("To")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Year" }));
    expect(await screen.findByLabelText("Year")).toBeTruthy();
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain(
      "from=2026-01-01&to=2026-12-31",
    );
  });
});
