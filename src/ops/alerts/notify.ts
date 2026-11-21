import { and, eq, inArray, isNull } from "drizzle-orm";

import type { Database } from "@/db/client";
import { slotAlert } from "@/db/schema";
import { cairoParts } from "@/lib/cairo-time";
import type { Clock } from "@/lib/clock";
import type { BookingLocale } from "@/lib/booking-link";
import { queueMessage } from "@/messaging/outbox";

// The notification half of slot alerts (docs/features/slot-alerts): when a
// booking stops blocking its slot, every subscriber is queued a message with a
// link to the booking form, in a transaction with the change that freed it. A
// subscription is told once; confirming the slot ends the watch.

/** The database or a transaction. */
type Executor = Pick<Database, "select" | "update" | "insert" | "delete">;

export interface SlotRange {
  startsAt: Date;
  endsAt: Date;
}

function prefix(locale: BookingLocale): string {
  return locale === "ar" ? "" : `/${locale}`;
}

function base(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/** The booking form for a freed slot, in the recipient's language. */
export function slotBookingLink(
  baseUrl: string,
  locale: BookingLocale,
  range: SlotRange,
): string {
  const start = cairoParts(range.startsAt);
  const end = cairoParts(range.endsAt);
  const query = new URLSearchParams({
    day: start.day,
    start: start.time,
    end: end.time,
  });
  return `${base(baseUrl)}${prefix(locale)}/book?${query}`;
}

/** The one-use unsubscribe page for a subscription. */
export function slotUnsubscribeLink(
  baseUrl: string,
  locale: BookingLocale,
  token: string,
): string {
  return `${base(baseUrl)}${prefix(locale)}/alerts/unsubscribe/${encodeURIComponent(token)}`;
}

/**
 * Queues one message per pending subscriber of `range` and stamps them as
 * notified. Call it with the transaction that freed the slot; rows are locked so
 * two sweeps cannot queue the same message twice. Returns how many were queued.
 */
export async function notifySlotAlerts(
  executor: Executor,
  clock: Clock,
  range: SlotRange,
  baseUrl: string,
): Promise<number> {
  const rows = await executor
    .select({
      id: slotAlert.id,
      phone: slotAlert.phone,
      locale: slotAlert.locale,
      token: slotAlert.token,
    })
    .from(slotAlert)
    .where(
      and(
        eq(slotAlert.startsAt, range.startsAt),
        eq(slotAlert.endsAt, range.endsAt),
        isNull(slotAlert.notifiedAt),
      ),
    )
    .for("update");

  if (rows.length === 0) return 0;
  const now = clock.now();

  for (const row of rows) {
    await queueMessage(executor, clock, {
      template: "slot-alert",
      recipient: row.phone,
      values: {
        link: slotBookingLink(baseUrl, row.locale, range),
        unsubscribe: slotUnsubscribeLink(baseUrl, row.locale, row.token),
        slotStartAt: range.startsAt.toISOString(),
      },
      locale: row.locale,
      // A "your slot is free" text is useless once the slot has started.
      expiresAt: range.startsAt,
    });
  }

  await executor
    .update(slotAlert)
    .set({ notifiedAt: now })
    .where(
      inArray(
        slotAlert.id,
        rows.map((row) => row.id),
      ),
    );
  return rows.length;
}

/**
 * Ends pending watches on a slot that someone else now owns (confirmed, or held
 * by a new booking). Already-notified rows stay as history.
 */
export async function closeSlotAlerts(
  executor: Executor,
  range: SlotRange,
): Promise<void> {
  await executor
    .delete(slotAlert)
    .where(
      and(
        eq(slotAlert.startsAt, range.startsAt),
        eq(slotAlert.endsAt, range.endsAt),
        isNull(slotAlert.notifiedAt),
      ),
    );
}
