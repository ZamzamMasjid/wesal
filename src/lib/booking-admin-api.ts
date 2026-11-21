import type { ApiEnvelope } from "./api-envelope";
import { isValidDay } from "./cairo-time";

// The browser side of booking management (docs/features/booking-management) and
// the shared shapes the operations return, so a change in one place is a type
// error in the other. Every endpoint requires a staff session; the server
// decides, never the page.

export const BOOKING_STATUSES = [
  "held",
  "proof_submitted",
  "confirmed",
  "expired",
  "rejected",
  "cancelled",
] as const;

export type AdminBookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_SOURCES = ["online", "staff"] as const;

export type AdminBookingSource = (typeof BOOKING_SOURCES)[number];

/** Bookings per page; the same number the patterns doc fixes (25). */
export const BOOKINGS_PAGE_SIZE = 25;

export interface BookingsFilters {
  /** `YYYY-MM-DD`, Africa/Cairo. Absent means "from now" (upcoming). */
  from?: string;
  /** `YYYY-MM-DD`, Africa/Cairo, inclusive. */
  to?: string;
  status?: AdminBookingStatus;
  source?: AdminBookingSource;
  /** Name, phone or booking ID. */
  q?: string;
  page?: number;
}

export interface AdminBookingListItem {
  /** The database row's id; not shown to staff. */
  id: number;
  /** The short code staff and customers use. */
  bookingId: string;
  status: AdminBookingStatus;
  source: AdminBookingSource;
  occasion: { nameAr: string; nameEn: string };
  customerName: string;
  customerPhone: string;
  /** `YYYY-MM-DD`, Africa/Cairo. */
  day: string;
  /** `HH:MM`, Africa/Cairo. */
  start: string;
  /** `HH:MM`, Africa/Cairo. */
  end: string;
  priceEgp: number;
  depositEgp: number;
  remainderEgp: number;
  remainderPaid: boolean;
  createdAt: string;
}

export type AdminHistoryAction =
  | "created"
  | "proof_uploaded"
  | "proof_received"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "remainder_paid";

export interface AdminBookingHistoryEntry {
  at: string;
  /** Who caused it: the customer, or a staff member. */
  actor: "customer" | "staff";
  /** The staff member's name, when the entry is theirs. */
  actorName?: string;
  action: AdminHistoryAction;
  /** A free-text note, e.g. the cancellation reason or the entry note. */
  note?: string;
}

export interface AdminBookingProof {
  id: number;
  receivedVia: "upload" | "whatsapp";
  uploadedAt: string;
  purgedAt: string | null;
}

export interface AdminBookingDetail extends AdminBookingListItem {
  /** Newest first. */
  proofs: AdminBookingProof[];
  /** Oldest first, so the story reads down the page. */
  history: AdminBookingHistoryEntry[];
}

export interface BookingsPage {
  items: AdminBookingListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** When the server read the list, so the view never trusts the client clock. */
  refreshedAt: string;
}

export interface AdminBookingDecision {
  bookingId: string;
  status: AdminBookingStatus;
  remainderPaid?: boolean;
}

export interface CreateStaffBookingInput {
  /** `YYYY-MM-DD`, Africa/Cairo. */
  day: string;
  /** `HH:MM`, Africa/Cairo. */
  start: string;
  /** `HH:MM`, Africa/Cairo. */
  end: string;
  occasionId: number;
  name: string;
  phone: string;
  /** Free text, e.g. that a deposit was taken offline. */
  note?: string;
}

export interface StaffBookingCreated {
  bookingId: string;
  day: string;
  start: string;
  end: string;
  priceEgp: number;
  depositEgp: number;
}

/** Turns the filters into the query string the list endpoint reads. Empty values are dropped. */
export function filtersToQuery(filters: BookingsFilters): string {
  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.status) query.set("status", filters.status);
  if (filters.source) query.set("source", filters.source);
  if (filters.q?.trim()) query.set("q", filters.q.trim());
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  const value = query.toString();
  return value ? `?${value}` : "";
}

type SearchValue = string | string[] | undefined;

/**
 * Reads filters from a page's `searchParams` or the URL. Unknown or malformed
 * values are dropped rather than failing the page, so a hand-edited URL shows
 * the default list instead of an error.
 */
export function parseFilters(
  search: Record<string, SearchValue> | URLSearchParams,
): BookingsFilters {
  const read = (key: string): string => {
    if (search instanceof URLSearchParams) return search.get(key)?.trim() ?? "";
    const value = search[key];
    return typeof value === "string" ? value.trim() : "";
  };

  const filters: BookingsFilters = {};
  const from = read("from");
  const to = read("to");
  if (isValidDay(from)) filters.from = from;
  if (isValidDay(to)) filters.to = to;
  const status = read("status");
  if ((BOOKING_STATUSES as readonly string[]).includes(status)) {
    filters.status = status as AdminBookingStatus;
  }
  const source = read("source");
  if ((BOOKING_SOURCES as readonly string[]).includes(source)) {
    filters.source = source as AdminBookingSource;
  }
  const q = read("q");
  if (q) filters.q = q.slice(0, 100);
  const page = Number(read("page"));
  if (Number.isInteger(page) && page > 1) filters.page = page;
  return filters;
}

function networkFailure<T>(): ApiEnvelope<T> {
  return { ok: false, error: { code: "NETWORK" } };
}

async function call<T>(
  url: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<ApiEnvelope<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body
        ? { "content-type": "application/json" }
        : { accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return networkFailure<T>();
  }
}

export function fetchBookings(
  filters: BookingsFilters,
): Promise<ApiEnvelope<BookingsPage>> {
  return call<BookingsPage>(
    `/api/v1/staff/bookings${filtersToQuery(filters)}`,
    "GET",
  );
}

export function fetchBookingDetail(
  bookingId: string,
): Promise<ApiEnvelope<AdminBookingDetail>> {
  return call<AdminBookingDetail>(
    `/api/v1/staff/bookings/${encodeURIComponent(bookingId)}`,
    "GET",
  );
}

export function createStaffBooking(
  input: CreateStaffBookingInput,
): Promise<ApiEnvelope<StaffBookingCreated>> {
  return call<StaffBookingCreated>("/api/v1/staff/bookings", "POST", input);
}

export function cancelBooking(
  bookingId: string,
  reason: string,
): Promise<ApiEnvelope<AdminBookingDecision>> {
  return call<AdminBookingDecision>(
    `/api/v1/staff/bookings/${encodeURIComponent(bookingId)}/cancel`,
    "POST",
    { reason },
  );
}

export function markRemainderPaid(
  bookingId: string,
): Promise<ApiEnvelope<AdminBookingDecision>> {
  return call<AdminBookingDecision>(
    `/api/v1/staff/bookings/${encodeURIComponent(bookingId)}/remainder-paid`,
    "POST",
    {},
  );
}
