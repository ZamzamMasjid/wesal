import type { ApiEnvelope } from "./api-envelope";

// The browser side of payment review (docs/features/payment-review). A staff
// session is required by every endpoint; the server decides, never the page.
// The queue and review types are shared with the operations so a change in one
// place is a type error in the other.

export const REJECT_REASONS = [
  "wrong_amount",
  "unreadable_image",
  "no_transfer",
  "other",
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

export interface ReviewProof {
  id: number;
  receivedVia: "upload" | "whatsapp";
  uploadedAt: string;
  /** Set once the file was deleted; the row stays so the trail shows it existed. */
  purgedAt: string | null;
}

export interface ReviewQueueItem {
  /** The database row's id; not shown to staff. */
  id: number;
  /** The short booking code staff and customers use. */
  bookingId: string;
  status: "held" | "proof_submitted";
  urgent: boolean;
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
  /** When the booking entered the queue: its first proof, or the hold itself. */
  waitingSince: string;
  /** The hold deadline for a held booking; null once proof is in. */
  deadlineAt: string | null;
  /** The newest proof, if any. Its file may already be purged. */
  proof: ReviewProof | null;
  proofCount: number;
}

export interface ReviewQueue {
  items: ReviewQueueItem[];
  /** When the server read the queue, so waiting times never trust the client clock. */
  refreshedAt: string;
}

export interface ReviewDetail {
  id: number;
  bookingId: string;
  status:
    | "held"
    | "proof_submitted"
    | "confirmed"
    | "expired"
    | "rejected"
    | "cancelled";
  urgent: boolean;
  occasion: { nameAr: string; nameEn: string };
  customerName: string;
  customerPhone: string;
  day: string;
  start: string;
  end: string;
  priceEgp: number;
  depositEgp: number;
  remainderEgp: number;
  createdAt: string;
  deadlineAt: string | null;
  /** Newest first: staff check the most recent screenshot. */
  proofs: ReviewProof[];
}

export interface ReviewDecision {
  bookingId: string;
  status: "confirmed" | "rejected" | "proof_submitted";
  proofId?: number;
}

/** The review page's path for one booking. */
export function reviewHref(bookingId: string): string {
  return `/dashboard/review/${encodeURIComponent(bookingId)}`;
}

/** The review page, in the language a staff alert is written in. */
export function reviewPath(locale: "ar" | "en", bookingId: string): string {
  const prefix = locale === "ar" ? "" : `/${locale}`;
  return `${prefix}${reviewHref(bookingId)}`;
}

/** The absolute review link that goes in a staff WhatsApp/SMS alert. */
export function absoluteReviewLink(
  baseUrl: string,
  locale: "ar" | "en",
  bookingId: string,
): string {
  return `${baseUrl.replace(/\/+$/, "")}${reviewPath(locale, bookingId)}`;
}

/** The staff-only screenshot endpoint (ADR-013: never a public URL). */
export function proofFileHref(proofId: number): string {
  return `/api/v1/staff/proofs/${proofId}/file`;
}

/**
 * Urgent first, then the longest wait. The queue endpoint returns this order;
 * the browser repeats it so a stale or reordered answer still reads correctly.
 */
export function orderReviewQueue(items: ReviewQueueItem[]): ReviewQueueItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.urgent) - Number(a.urgent) ||
      Date.parse(a.waitingSince) - Date.parse(b.waitingSince) ||
      a.id - b.id,
  );
}

/**
 * Whole minutes a queue item has waited, measured from the server's own clock:
 * `waitingSince` against the `refreshedAt` the answer carried. Never negative.
 */
export function waitingMinutes(
  waitingSince: string,
  refreshedAt: string,
): number {
  const since = Date.parse(waitingSince);
  const now = Date.parse(refreshedAt);
  if (Number.isNaN(since) || Number.isNaN(now)) return 0;
  return Math.max(0, Math.floor((now - since) / 60_000));
}

/** Which localized waiting phrase a number of minutes uses. */
export function waitingUnit(minutes: number): {
  unit: "minutes" | "hours" | "days";
  count: number;
} {
  if (minutes < 60) return { unit: "minutes", count: minutes };
  if (minutes < 24 * 60)
    return { unit: "hours", count: Math.floor(minutes / 60) };
  return { unit: "days", count: Math.floor(minutes / (24 * 60)) };
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

export function fetchReviewQueue(): Promise<ApiEnvelope<ReviewQueue>> {
  return call<ReviewQueue>("/api/v1/staff/review-queue", "GET");
}

export function fetchReviewDetail(
  bookingId: string,
): Promise<ApiEnvelope<ReviewDetail>> {
  return call<ReviewDetail>(
    `/api/v1/staff/review-queue/${encodeURIComponent(bookingId)}`,
    "GET",
  );
}

export function confirmBooking(
  bookingId: string,
): Promise<ApiEnvelope<ReviewDecision>> {
  return call<ReviewDecision>(
    `/api/v1/staff/bookings/${encodeURIComponent(bookingId)}/confirm`,
    "POST",
    {},
  );
}

export function rejectBooking(
  bookingId: string,
  reason: RejectReason,
  note?: string,
): Promise<ApiEnvelope<ReviewDecision>> {
  return call<ReviewDecision>(
    `/api/v1/staff/bookings/${encodeURIComponent(bookingId)}/reject`,
    "POST",
    { reason, note: note?.trim() ? note.trim() : null },
  );
}

export function markProofReceived(
  bookingId: string,
  confirm: boolean,
): Promise<ApiEnvelope<ReviewDecision>> {
  return call<ReviewDecision>(
    `/api/v1/staff/bookings/${encodeURIComponent(bookingId)}/proof-received`,
    "POST",
    { confirm },
  );
}
