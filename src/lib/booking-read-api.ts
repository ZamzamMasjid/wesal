// The browser side of the private booking page (docs/features/booking-page).
// Every answer uses the API envelope (ADR-026), so a failure has a stable code
// the page can translate. The pure helpers are shared with the server.

import type { ApiEnvelope } from "./api-envelope";
import { latinDigits } from "./digits";

export type PublicBookingStatus =
  | "held"
  | "proof_submitted"
  | "confirmed"
  | "expired"
  | "rejected"
  | "cancelled";

/** How to pay the deposit. Present only while the booking is still payable. */
export interface BookingTransfer {
  vodafoneCashNumber: string | null;
  instapayAddress: string | null;
}

/** One booking as its holder may see it. Never contains the phone number. */
export interface PublicBooking {
  /** The short code the customer reads aloud. */
  bookingId: string;
  status: PublicBookingStatus;
  occasion: { nameAr: string; nameEn: string };
  customerName: string;
  /** `YYYY-MM-DD`, Africa/Cairo. */
  day: string;
  /** `HH:MM`, Africa/Cairo. */
  start: string;
  /** `HH:MM`, Africa/Cairo. */
  end: string;
  priceEgp: number;
  depositEgp: number;
  /** What is still due at the venue: price minus deposit. */
  remainderEgp: number;
  remainderPaid: boolean;
  /** The hold deadline while held; null once the clock has stopped. */
  deadlineAt: string | null;
  transfer: BookingTransfer | null;
  createdAt: string;
  /** When the server read this, so the countdown never trusts the client clock. */
  refreshedAt: string;
}

export interface BookingLookup {
  bookingId: string;
  /** The secret in the booking page's link; the page opens with it. */
  token: string;
}

/**
 * What a customer typed as a booking ID, as the database stores it. Spaces and
 * hyphens are dropped (they are never part of an ID) and Arabic-Indic digits
 * become Latin, because the ID is read off a screen and typed back.
 */
export function normalizeBookingId(value: string): string {
  return latinDigits(value).replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Whole seconds left, measured from the server's own clock: the deadline minus
 * the `refreshedAt` the response carried. Never negative.
 */
export function remainingFromServer(
  deadlineAt: string | null,
  refreshedAt: string,
): number {
  if (!deadlineAt) return 0;
  const deadline = Date.parse(deadlineAt);
  const serverNow = Date.parse(refreshedAt);
  if (Number.isNaN(deadline) || Number.isNaN(serverNow)) return 0;
  return Math.max(0, Math.ceil((deadline - serverNow) / 1000));
}

export async function fetchBookingByToken(
  token: string,
): Promise<ApiEnvelope<PublicBooking>> {
  try {
    const response = await fetch(
      `/api/v1/bookings/by-token/${encodeURIComponent(token)}`,
      { headers: { accept: "application/json" } },
    );
    return (await response.json()) as ApiEnvelope<PublicBooking>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

export async function lookupBooking(
  bookingId: string,
): Promise<ApiEnvelope<BookingLookup>> {
  const query = new URLSearchParams({ bookingId });
  try {
    const response = await fetch(`/api/v1/bookings/lookup?${query}`, {
      headers: { accept: "application/json" },
    });
    return (await response.json()) as ApiEnvelope<BookingLookup>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}
