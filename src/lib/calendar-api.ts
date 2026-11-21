// The browser side of the availability poll (ADR-014). The page asks for one
// month at a time; a failure keeps the previous states on screen.

import type { ApiEnvelope } from "./api-envelope";

export type SlotState =
  "free" | "awaiting_payment" | "awaiting_review" | "confirmed" | "closed";

export type SlotAction = "book" | "call" | "none";

export interface AvailabilitySlot {
  /** `HH:MM`, Africa/Cairo. */
  start: string;
  end: string;
  state: SlotState;
  action: SlotAction;
  /** Whether the visitor can ask to be told if this taken slot frees up. */
  alert: boolean;
}

export interface AvailabilityDay {
  day: string;
  closed: boolean;
  slots: AvailabilitySlot[];
}

export interface Availability {
  from: string;
  to: string;
  today: string;
  refreshedAt: string;
  days: AvailabilityDay[];
}

export async function fetchAvailability(
  from: string,
  to: string,
  init?: RequestInit,
): Promise<ApiEnvelope<Availability>> {
  const query = new URLSearchParams({ from, to });
  try {
    const response = await fetch(`/api/v1/availability?${query}`, {
      ...init,
      headers: { accept: "application/json", ...init?.headers },
    });
    return (await response.json()) as ApiEnvelope<Availability>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}
