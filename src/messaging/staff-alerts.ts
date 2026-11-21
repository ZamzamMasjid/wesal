import { count, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { staffDevice, staffUser } from "@/db/schema";
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
  /** E.164 phone number, when one is set. */
  phone: string | null;
  locale: Locale;
  /** How this person chose to be alerted. */
  channel: "push" | "whatsapp" | "both";
  /** Active registered devices, the number a push would fan out to. */
  devices: number;
}

/** A device count per staff member. */
async function deviceCounts(
  executor: Executor,
): Promise<Map<string, number>> {
  const rows = await executor
    .select({ userId: staffDevice.userId, total: count() })
    .from(staffDevice)
    .where(eq(staffDevice.active, true))
    .groupBy(staffDevice.userId);
  return new Map(rows.map((row) => [row.userId, Number(row.total)]));
}

/**
 * Who receives an alert. Active staff with alerts on choose push, WhatsApp or
 * both; push users also need a registered device. When nobody is opted in, the
 * owner's phone is used anyway, so a proof never waits with nobody told
 * (staff-notifications spec). Disabled accounts are never recipients.
 */
export async function resolveStaffAlertRecipients(
  executor: Executor,
): Promise<StaffAlertRecipient[]> {
  const [rows, devices] = await Promise.all([
    executor
      .select({
        id: staffUser.id,
        role: staffUser.role,
        notifyPhone: staffUser.notifyPhone,
        notifyEnabled: staffUser.notifyEnabled,
        locale: staffUser.locale,
        alertChannel: staffUser.alertChannel,
      })
      .from(staffUser)
      .where(eq(staffUser.active, true)),
    deviceCounts(executor),
  ]);

  const optedIn = rows
    .filter((row) => {
      if (!row.notifyEnabled) return false;
      const registered = devices.get(row.id) ?? 0;
      if (row.notifyPhone) return true;
      // A push-only account without a phone is still reachable on its devices.
      return row.alertChannel !== "whatsapp" && registered > 0;
    })
    .map((row) => ({
      id: row.id,
      phone: row.notifyPhone ?? null,
      locale: row.locale,
      channel: row.alertChannel,
      devices: devices.get(row.id) ?? 0,
    }));
  if (optedIn.length > 0) return optedIn;

  return rows
    .filter((row) => row.role === "owner" && row.notifyPhone)
    .map((row) => ({
      id: row.id,
      phone: row.notifyPhone!,
      locale: row.locale,
      channel: "whatsapp" as const,
      devices: devices.get(row.id) ?? 0,
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
    const values = {
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
    };

    const wantsPush =
      (recipient.channel === "push" || recipient.channel === "both") &&
      recipient.devices > 0;
    const wantsWhatsApp =
      recipient.channel === "whatsapp" ||
      recipient.channel === "both" ||
      (recipient.channel === "push" && recipient.devices === 0);

    if (wantsPush) {
      await queueMessage(executor, clock, {
        template: "staff-alert",
        recipient: recipient.id,
        channel: "push",
        values,
        locale: recipient.locale,
        bookingId: input.booking.id,
        expiresAt,
      });
    }
    if (wantsWhatsApp && recipient.phone) {
      await queueMessage(executor, clock, {
        template: "staff-alert",
        recipient: recipient.phone,
        values,
        locale: recipient.locale,
        bookingId: input.booking.id,
        expiresAt,
      });
    }
  }
  return recipients;
}
