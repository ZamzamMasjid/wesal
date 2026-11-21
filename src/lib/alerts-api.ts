// The browser side of slot alerts (docs/features/slot-alerts): subscribe to a
// taken slot after verifying the phone, and unsubscribe from the link in the
// message. Answers use the API envelope (ADR-026).

import type { ApiEnvelope } from "./api-envelope";

export interface AlertSubscription {
  phone: string;
  subscribed: boolean;
}

export async function createSlotAlert(input: {
  /** `YYYY-MM-DD`, Africa/Cairo. */
  day: string;
  /** `HH:MM`, Africa/Cairo. */
  start: string;
  /** `HH:MM`, Africa/Cairo. */
  end: string;
  phone: string;
  /** The verified-phone token from `verification.check`. */
  token: string;
  locale: "ar" | "en";
}): Promise<ApiEnvelope<AlertSubscription>> {
  try {
    const response = await fetch("/api/v1/alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await response.json()) as ApiEnvelope<AlertSubscription>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}

export async function unsubscribeSlotAlert(
  token: string,
): Promise<ApiEnvelope<{ unsubscribed: boolean }>> {
  try {
    const response = await fetch(
      `/api/v1/alerts/${encodeURIComponent(token)}`,
      {
        method: "DELETE",
      },
    );
    return (await response.json()) as ApiEnvelope<{ unsubscribed: boolean }>;
  } catch {
    return { ok: false, error: { code: "NETWORK" } };
  }
}
