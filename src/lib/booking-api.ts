// The browser side of creating a hold. Every answer uses the API envelope
// (ADR-026), so a failure always has a stable code the form can translate.

import type { ApiEnvelope } from "./api-envelope";
import type { BookingLocale } from "./booking-link";

export interface CreateHoldInput {
  /** `YYYY-MM-DD`, Africa/Cairo. */
  day: string;
  /** `HH:MM`, Africa/Cairo. */
  start: string;
  /** `HH:MM`, Africa/Cairo. */
  end: string;
  occasionId: number;
  name: string;
  phone: string;
  /** The verified-phone token issued by the code step. */
  token: string;
  locale: BookingLocale;
}

export interface HoldCreated {
  /** The short code shown to the customer. */
  bookingId: string;
  /** The secret in the private booking page's link. */
  linkToken: string;
  deadlineAt: string;
  priceEgp: number;
  depositEgp: number;
  urgent: boolean;
}

export async function createHold(
  input: CreateHoldInput,
): Promise<ApiEnvelope<HoldCreated>> {
  try {
    const response = await fetch("/api/v1/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await response.json()) as ApiEnvelope<HoldCreated>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}
