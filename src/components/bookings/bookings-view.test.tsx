// @vitest-environment happy-dom
// SPEC: docs/design/views/bookings.md — the list filters by date, status and source, a row opens the detail, and staff add, cancel and mark the remainder paid
// ROADMAP: phase-4-operations / booking-management / Implement bookings view: list, detail, add-booking dialog
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import messages from "../../../messages/en.json";
import type {
  AdminBookingDetail,
  AdminBookingListItem,
  BookingsPage,
} from "@/lib/booking-admin-api";

import { BookingsView } from "./bookings-view";

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

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
});

function anItem(
  overrides: Partial<AdminBookingListItem> = {},
): AdminBookingListItem {
  return {
    id: 7,
    bookingId: "ABC234",
    status: "confirmed",
    source: "staff",
    occasion: { nameAr: "زفاف", nameEn: "Wedding" },
    customerName: "Mona",
    customerPhone: "+201001234567",
    day: "2026-12-25",
    start: "18:00",
    end: "20:00",
    priceEgp: 5000,
    depositEgp: 0,
    remainderEgp: 5000,
    remainderPaid: false,
    createdAt: "2026-12-20T07:00:00.000Z",
    ...overrides,
  };
}

function aPage(overrides: Partial<BookingsPage> = {}): BookingsPage {
  return {
    items: [anItem()],
    total: 1,
    page: 1,
    pageSize: 25,
    refreshedAt: "2026-12-20T08:00:00.000Z",
    ...overrides,
  };
}

function aDetail(
  overrides: Partial<AdminBookingDetail> = {},
): AdminBookingDetail {
  return {
    ...anItem(),
    proofs: [],
    history: [
      {
        at: "2026-12-20T07:00:00.000Z",
        actor: "staff",
        actorName: "Ahmed",
        action: "created",
        note: "Deposit taken in cash",
      },
    ],
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

interface Responses {
  list?: BookingsPage;
  detail?: AdminBookingDetail;
  availability?: unknown;
  create?: unknown;
  cancel?: unknown;
  paid?: unknown;
  proofReceived?: unknown;
}

function stubFetch(responses: Responses = {}) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/v1/availability")) {
        return jsonResponse(
          responses.availability ?? {
            ok: true,
            data: {
              from: "2026-12-20",
              to: "2026-12-20",
              today: "2026-12-20",
              refreshedAt: "2026-12-20T08:00:00.000Z",
              days: [
                {
                  day: "2026-12-20",
                  closed: false,
                  slots: [
                    {
                      start: "12:00",
                      end: "14:00",
                      state: "free",
                      action: "book",
                    },
                    {
                      start: "16:00",
                      end: "18:00",
                      state: "awaiting_payment",
                      action: "none",
                    },
                  ],
                },
              ],
            },
          },
        );
      }
      if (url.endsWith("/api/v1/staff/bookings") || url.includes("?")) {
        if (url.endsWith("/api/v1/staff/bookings") && init?.method === "POST") {
          return jsonResponse(
            responses.create ?? {
              ok: true,
              data: {
                bookingId: "NEW123",
                day: "2026-12-20",
                start: "12:00",
                end: "14:00",
                priceEgp: 1000,
                depositEgp: 0,
              },
            },
          );
        }
        return jsonResponse({ ok: true, data: responses.list ?? aPage() });
      }
      if (url.endsWith("/cancel")) {
        return jsonResponse(
          responses.cancel ?? {
            ok: true,
            data: { bookingId: "ABC234", status: "cancelled" },
          },
        );
      }
      if (url.endsWith("/remainder-paid")) {
        return jsonResponse(
          responses.paid ?? {
            ok: true,
            data: {
              bookingId: "ABC234",
              status: "confirmed",
              remainderPaid: true,
            },
          },
        );
      }
      if (url.endsWith("/proof-received")) {
        return jsonResponse(
          responses.proofReceived ?? {
            ok: true,
            data: {
              bookingId: "ABC234",
              status: "proof_submitted",
              proofId: 9,
            },
          },
        );
      }
      // Detail is the remaining /api/v1/staff/bookings/<id> route.
      return jsonResponse({ ok: true, data: responses.detail ?? aDetail() });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderView(
  options: {
    page?: BookingsPage;
    filters?: Parameters<typeof BookingsView>[0]["initialFilters"];
    detail?: AdminBookingDetail | null;
  } = {},
) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BookingsView
        initial={options.page ?? aPage()}
        initialFilters={options.filters ?? {}}
        initialDetail={options.detail ?? null}
        occasions={[
          { id: 1, nameAr: "زفاف", nameEn: "Wedding", priceEgp: 5000 },
        ]}
        today="2026-12-20"
      />
    </NextIntlClientProvider>,
  );
}

describe("BookingsView list", () => {
  it("shows every booking with its status, source and balance", () => {
    renderView();

    expect(screen.getAllByText("Wedding").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Entered by staff").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EGP 5,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unpaid").length).toBeGreaterThan(0);
    expect(screen.getByText("1 booking")).toBeTruthy();
  });

  it("opens one booking's detail and keeps the filters in the URL", async () => {
    stubFetch({ detail: aDetail() });
    renderView();

    fireEvent.click(
      screen.getAllByRole("button", { name: "Open booking ABC234" })[0]!,
    );

    expect(await screen.findByText("History")).toBeTruthy();
    expect(screen.getByText("Deposit taken in cash")).toBeTruthy();
    expect(replace).toHaveBeenCalledWith("/dashboard/bookings?booking=ABC234", {
      scroll: false,
    });
  });

  it("applies a status filter through the API and the URL", async () => {
    const fetchMock = stubFetch({ list: aPage() });
    renderView();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "confirmed" },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/staff/bookings?status=confirmed",
        expect.anything(),
      );
    });
    expect(replace).toHaveBeenCalledWith(
      "/dashboard/bookings?status=confirmed",
      { scroll: false },
    );
  });

  it("explains an inverted date range instead of replacing the page", () => {
    const fetchMock = stubFetch();
    renderView({ filters: { to: "2026-12-20" } });

    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-12-25" },
    });

    expect(
      screen.getByText("The end date must not be before the start date."),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("To")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add booking" })).toBeTruthy();
  });

  it("uses calm empty states for no bookings and for filters that match nothing", () => {
    stubFetch();
    renderView({ page: aPage({ items: [], total: 0 }) });
    expect(screen.getByText("Bookings will appear here")).toBeTruthy();
    cleanup();

    renderView({
      page: aPage({ items: [], total: 0 }),
      filters: { q: "zzz" },
    });
    expect(screen.getByText("No bookings match")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();
  });
});

describe("BookingsView detail", () => {
  it("closes the confirmation and shows the notice once the remainder is paid", async () => {
    const fetchMock = stubFetch();
    renderView({ detail: aDetail() });

    fireEvent.click(
      screen.getByRole("button", { name: "Mark remainder paid" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark paid" }));

    expect(await screen.findByText("Remainder marked paid.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/staff/bookings/ABC234/remainder-paid",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows a failed remainder mark inside the still-open confirmation", async () => {
    stubFetch({
      paid: {
        ok: false,
        error: { code: "INTERNAL", message: "boom" },
      },
    });
    renderView({ detail: aDetail() });

    fireEvent.click(
      screen.getByRole("button", { name: "Mark remainder paid" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark paid" }));

    expect(
      await within(dialog).findByText("Something went wrong. Try again."),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("marks a WhatsApp proof received on a held booking", async () => {
    const fetchMock = stubFetch({
      proofReceived: {
        ok: true,
        data: {
          bookingId: "ABC234",
          status: "proof_submitted",
          proofId: 9,
        },
      },
    });
    renderView({ detail: aDetail({ status: "held" }) });

    fireEvent.click(screen.getByRole("button", { name: "Mark received" }));

    expect(await screen.findByText("Proof marked received.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/staff/bookings/ABC234/proof-received",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("cancels only after a reason is entered", async () => {
    const fetchMock = stubFetch();
    renderView({ detail: aDetail() });

    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cancel booking" }),
    );
    expect(screen.getByText("Enter a reason.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/v1/staff/bookings/ABC234/cancel",
      expect.anything(),
    );

    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Family changed the date" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Cancel booking" }),
    );

    expect(await screen.findByText("Booking cancelled.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/staff/bookings/ABC234/cancel",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("explains that only a confirmed booking can be cancelled", () => {
    renderView({ detail: aDetail({ status: "cancelled" }) });

    expect(
      screen.getByText(
        "Only a confirmed booking can be cancelled. Held and awaiting-review bookings end by expiry or rejection.",
      ),
    ).toBeTruthy();
  });
});

describe("AddBookingDialog", () => {
  it("keeps a taken slot visible but not selectable", async () => {
    stubFetch();
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Add booking" }));

    const taken = await screen.findByRole("button", {
      name: "4:00 PM – 6:00 PM, Awaiting payment",
    });
    expect((taken as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByRole("button", { name: "12:00 PM – 2:00 PM, Free" }),
    ).toBeTruthy();
  });

  it("shows who holds the slot for 12 minutes when the server says SLOT_TAKEN", async () => {
    const holder = {
      bookingId: "HELD01",
      status: "held",
      customerName: "Hana",
      deadlineAt: "2026-12-20T10:00:00.000Z",
    };
    const fetchMock = stubFetch({
      create: {
        ok: false,
        error: { code: "SLOT_TAKEN", details: { holder } },
      },
    });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Add booking" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "12:00 PM – 2:00 PM, Free",
      }),
    );
    fireEvent.change(within(dialog).getByLabelText("Occasion"), {
      target: { value: "1" },
    });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Mona" },
    });
    fireEvent.change(within(dialog).getByLabelText("Phone"), {
      target: { value: "01001234567" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add booking" }),
    );

    expect(
      await screen.findByText("This slot already has a booking."),
    ).toBeTruthy();
    // 10:00 UTC is 12:00 in Cairo in December (UTC+2).
    expect(
      screen.getByText("Hana holds this slot until 12:00 PM."),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/staff/bookings",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends the customer's chosen message language", async () => {
    const fetchMock = stubFetch();
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Add booking" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "12:00 PM – 2:00 PM, Free",
      }),
    );
    fireEvent.change(within(dialog).getByLabelText("Occasion"), {
      target: { value: "1" },
    });
    fireEvent.change(within(dialog).getByLabelText("Message language"), {
      target: { value: "en" },
    });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Mona" },
    });
    fireEvent.change(within(dialog).getByLabelText("Phone"), {
      target: { value: "01001234567" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add booking" }),
    );

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(
        ([input, init]) =>
          String(input) === "/api/v1/staff/bookings" &&
          (init as RequestInit | undefined)?.method === "POST",
      );
      expect(post).toBeTruthy();
      const body = JSON.parse(
        String((post?.[1] as RequestInit | undefined)?.body),
      ) as { locale?: string };
      expect(body.locale).toBe("en");
    });
  });
});
