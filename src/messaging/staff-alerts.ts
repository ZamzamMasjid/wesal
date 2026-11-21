import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { staffUser } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import type { Logger } from "@/lib/logger";
import { absoluteReviewLink } from "@/lib/review-api";

import { queueMessage } from "./outbox";
import type { Locale } from "./templates";

// Staff alerts (docs/features/staff-notifications): a proof waiting for review,
// or an urgent hold on a slot starting soon. Each alert is an outbox row queued
// in the transaction of the change that caused it, so a message is never sent
// for a change that did not commit (ADR-011). The text carries a link to the
// review page, never the screenshot (ADR-013). One row per recipient, written in
// that staff member's language.

export type StaffAlertKind = "proof" | "urgent";

export interface StaffAlertBooking {
  /** The database row id, recorded on the outbox row. */
  id: number;
  /** The short public code the review link is built from. */
  publicId: string;
  customerName: string;
  occasionNameAr: string;
  occasionNameEn: string;
  startsAt: Date;
  depositEgp: number;
}

/** A transaction or the database: the alert commits with its change. */
type Executor = Pick<Database, "insert" | "select">;

export interface StaffAlertRecipient {
  id: string;
  /** E.164 phone number. */
  phone: string;
  locale: Locale;
}

/**
 * Who receives an alert. Active staff with a phone who have alerts on win; when
 * nobody is opted in, the owner's phone is used anyway, so a proof never waits
 * with nobody told (staff-notifications spec). Disabled accounts and accounts
 * without a phone are never recipients.
 */
export async function resolveStaffAlertRecipients(
  executor: Executor,
): Promise<StaffAlertRecipient[]> {
  const rows = await executor
    .select({
      id: staffUser.id,
      role: staffUser.role,
      notifyPhone: staffUser.notifyPhone,
      notifyEnabled: staffUser.notifyEnabled,
      locale: staffUser.locale,
    })
    .from(staffUser)
    .where(eq(staffUser.active, true));

  const optedIn = rows
    .filter((row) => row.notifyPhone && row.notifyEnabled)
    .map((row) => ({
      id: row.id,
      phone: row.notifyPhone!,
      locale: row.locale,
    }));
  if (optedIn.length > 0) return optedIn;

  return rows
    .filter((row) => row.role === "owner" && row.notifyPhone)
    .map((row) => ({
      id: row.id,
      phone: row.notifyPhone!,
      locale: row.locale,
    }));
}

export interface QueueStaffAlertInput {
  kind: StaffAlertKind;
  booking: StaffAlertBooking;
  /** Public origin, for the review link in the message. */
  baseUrl: string;
  /** Where a warning goes if nobody can be alerted. */
  logger?: Pick<Logger, "warn">;
  /** Defaults to the slot start: after it, the alert is no longer useful. */
  expiresAt?: Date;
}

/**
 * Queues one alert per recipient, inside the caller's transaction. Returns the
 * recipients so a test can assert who was told; an empty list means nobody could
 * be (no active account has a phone), which is logged and never throws.
 */
export async function queueStaffAlert(
  executor: Executor,
  clock: Clock,
  input: QueueStaffAlertInput,
): Promise<StaffAlertRecipient[]> {
  const recipients = await resolveStaffAlertRecipients(executor);
  if (recipients.length === 0) {
    input.logger?.warn("staff alert has no recipient with a phone", {
      kind: input.kind,
      bookingId: input.booking.publicId,
    });
    return [];
  }

  const expiresAt = input.expiresAt ?? input.booking.startsAt;
  for (const recipient of recipients) {
    await queueMessage(executor, clock, {
      template: "staff-alert",
      recipient: recipient.phone,
      values: {
        kind: input.kind,
        link: absoluteReviewLink(
          input.baseUrl,
          recipient.locale,
          input.booking.publicId,
        ),
        occasion:
          recipient.locale === "ar"
            ? input.booking.occasionNameAr
            : input.booking.occasionNameEn,
        slotStartAt: input.booking.startsAt.toISOString(),
        customerName: input.booking.customerName,
        ...(input.kind === "proof"
          ? { depositEgp: String(input.booking.depositEgp) }
          : {}),
      },
      locale: recipient.locale,
      bookingId: input.booking.id,
      expiresAt,
    });
  }
  return recipients;
}
