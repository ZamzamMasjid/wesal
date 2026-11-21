import { and, asc, eq, inArray, lte } from "drizzle-orm";

import type { Database } from "@/db/client";
import { outboxMessage, staffDevice, staffUser } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import type { Logger } from "@/lib/logger";

import type { PushProvider } from "./push";
import type { Channel, MessageSender } from "./sender";
import {
  renderTemplate,
  type Locale,
  type TemplateName,
  type TemplateValues,
} from "./templates";

// The outbox (ADR-011): messages other than verification codes are recorded in
// the same transaction as the change that causes them and sent by the job loop.
// Delivery is at-least-once. Sending is retried with increasing delays; a
// WhatsApp message that cannot be delivered is sent again by SMS.

/** Failed attempts on one channel before giving up on it. */
export const MAX_ATTEMPTS = 5;
/** Wait after the 1st, 2nd, ... failed attempt, in seconds. */
export const BACKOFF_SECONDS = [30, 120, 600, 1800] as const;
/** A claimed message is not claimed again for this long (a crashed run is retried after it). */
const CLAIM_LEASE_SECONDS = 120;
const BATCH_SIZE = 20;

export function backoffSeconds(failedAttempts: number): number {
  const index = Math.min(Math.max(failedAttempts, 1), BACKOFF_SECONDS.length);
  return BACKOFF_SECONDS[index - 1]!;
}

const plusSeconds = (date: Date, seconds: number) =>
  new Date(date.getTime() + seconds * 1000);

// ---------------------------------------------------------------------------
// Queueing

/** The database or a transaction, so the row commits with its change. */
type Executor = Pick<Database, "insert">;

/** Push rows are addressed by staff user, not phone (ADR-034). */
export type OutboxChannel = Channel | "push";

export interface QueueInput<T extends TemplateName> {
  template: T;
  /** E.164 phone number, or a staff user id for a push row. */
  recipient: string;
  values: TemplateValues<T>;
  locale: Locale;
  bookingId?: number;
  /** After this instant the message is dropped instead of sent late. */
  expiresAt?: Date;
  /** First channel; default WhatsApp. */
  channel?: OutboxChannel;
}

/**
 * Records a message to be sent by the job loop. Call it with the transaction of
 * the change that causes the message, so a message is never queued for a change
 * that did not commit. Throws (before writing) if `values` do not fit the template.
 */
export async function queueMessage<T extends TemplateName>(
  executor: Executor,
  clock: Clock,
  input: QueueInput<T>,
): Promise<void> {
  // Render once now: bad values fail here, in the caller's transaction, not
  // later in the loop.
  renderTemplate(input.template, input.locale, input.values);
  const now = clock.now();
  await executor.insert(outboxMessage).values({
    bookingId: input.bookingId ?? null,
    recipient: input.recipient,
    channel: input.channel ?? "whatsapp",
    template: input.template,
    values: input.values as Record<string, string>,
    locale: input.locale,
    nextAttemptAt: now,
    expiresAt: input.expiresAt ?? null,
  });
}

// ---------------------------------------------------------------------------
// Inline sending (verification codes)

/** Neither channel could deliver an inline message. */
export class MessageDeliveryError extends Error {
  readonly causes: Error[];
  constructor(causes: Error[]) {
    super("The message could not be delivered on any channel.");
    this.name = "MessageDeliveryError";
    this.causes = causes;
  }
}

export interface InlineDeps {
  sender: MessageSender;
  logger: Logger;
}

/**
 * Sends now, during the caller's request: WhatsApp first, then SMS. Resolves
 * with the channel that accepted the message, or throws MessageDeliveryError.
 * Nothing is recorded; the caller decides what a failure means (ADR-016).
 */
export async function sendInline<T extends TemplateName>(
  deps: InlineDeps,
  input: Pick<QueueInput<T>, "template" | "recipient" | "values" | "locale">,
): Promise<{ channel: Channel; providerMessageId: string }> {
  const body = renderTemplate(input.template, input.locale, input.values);
  const causes: Error[] = [];
  for (const channel of ["whatsapp", "sms"] as const) {
    try {
      const { providerMessageId } = await deps.sender.send({
        channel,
        to: input.recipient,
        body,
      });
      return { channel, providerMessageId };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      causes.push(error);
      deps.logger.warn("inline message failed", {
        channel,
        template: input.template,
        err: error,
      });
    }
  }
  throw new MessageDeliveryError(causes);
}

// ---------------------------------------------------------------------------
// The outbox sender (one job of the loop)

export interface OutboxDeps {
  db: Database;
  sender: MessageSender;
  push: PushProvider;
  clock: Clock;
  logger: Logger;
}

export interface OutboxRunSummary {
  sent: number;
  retried: number;
  fellBack: number;
  failed: number;
  expired: number;
}

type OutboxRow = typeof outboxMessage.$inferSelect;

/** Takes due messages so no other run sends them at the same time. */
async function claimDue(deps: OutboxDeps): Promise<OutboxRow[]> {
  const now = deps.clock.now();
  return deps.db.transaction(async (tx) => {
    const due = await tx
      .select({ id: outboxMessage.id })
      .from(outboxMessage)
      .where(
        and(
          eq(outboxMessage.status, "queued"),
          lte(outboxMessage.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(outboxMessage.nextAttemptAt), asc(outboxMessage.id))
      .limit(BATCH_SIZE)
      .for("update", { skipLocked: true });
    if (due.length === 0) return [];
    return tx
      .update(outboxMessage)
      .set({ nextAttemptAt: plusSeconds(now, CLAIM_LEASE_SECONDS) })
      .where(
        inArray(
          outboxMessage.id,
          due.map((r) => r.id),
        ),
      )
      .returning();
  });
}

/**
 * Sends every message that is due. Never throws for a single message: a failure
 * is recorded on its row and the next message is tried.
 */
export async function processOutbox(
  deps: OutboxDeps,
): Promise<OutboxRunSummary> {
  const summary: OutboxRunSummary = {
    sent: 0,
    retried: 0,
    fellBack: 0,
    failed: 0,
    expired: 0,
  };
  const rows = await claimDue(deps);
  for (const row of rows) {
    const now = deps.clock.now();
    const log = deps.logger.child({ outboxId: row.id });

    if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) {
      await finish(deps, row.id, "failed", "expired");
      log.info("outbox message dropped: no longer useful", {
        template: row.template,
      });
      summary.expired += 1;
      continue;
    }

    let body: string;
    try {
      body = renderTemplate(
        row.template,
        row.locale,
        row.values as TemplateValues<typeof row.template>,
      );
    } catch (err) {
      await finish(deps, row.id, "failed", "render failed");
      log.error("outbox message cannot be rendered", { err });
      summary.failed += 1;
      continue;
    }

    if (row.channel === "push") {
      const outcome = await sendPush(deps, row, body, now, log);
      summary[outcome] += 1;
      continue;
    }

    try {
      const { providerMessageId } = await deps.sender.send({
        channel: row.channel,
        to: row.recipient,
        body,
      });
      await deps.db
        .update(outboxMessage)
        .set({
          status: "sent",
          providerMessageId,
          lastError: null,
          updatedAt: now,
        })
        .where(eq(outboxMessage.id, row.id));
      log.info("outbox message sent", {
        template: row.template,
        channel: row.channel,
      });
      summary.sent += 1;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const attempts = row.attempts + 1;
      const detail = error.message.slice(0, 500);
      if (attempts < MAX_ATTEMPTS) {
        await deps.db
          .update(outboxMessage)
          .set({
            attempts,
            lastError: detail,
            nextAttemptAt: plusSeconds(now, backoffSeconds(attempts)),
            updatedAt: now,
          })
          .where(eq(outboxMessage.id, row.id));
        log.warn("outbox send failed; will retry", {
          attempts,
          channel: row.channel,
          err: error,
        });
        summary.retried += 1;
      } else if (row.channel === "whatsapp") {
        await fallBackToSms(deps.db, row.id, now, detail);
        log.warn("outbox WhatsApp send gave up; falling back to SMS", {
          err: error,
        });
        summary.fellBack += 1;
      } else {
        await finish(deps, row.id, "failed", detail, attempts);
        log.error("outbox message failed for good", {
          template: row.template,
          attempts,
          err: error,
        });
        summary.failed += 1;
      }
    }
  }
  return summary;
}

type PushOutcome = "sent" | "retried" | "fellBack" | "failed";

function pushTitle(row: OutboxRow): string {
  const kind = row.values.kind;
  if (row.locale === "ar") {
    return kind === "proof" ? "إثبات دفع بانتظار المراجعة" : "حجز عاجل";
  }
  return kind === "proof" ? "Payment proof to review" : "Urgent hold";
}

/**
 * Sends one staff member's alert to every active device (ADR-034). One accepted
 * ticket counts as delivered; unregistered tokens are deactivated. When no
 * device can receive it, the last attempt falls back to WhatsApp instead of
 * dropping the alert.
 */
async function sendPush(
  deps: OutboxDeps,
  row: OutboxRow,
  body: string,
  now: Date,
  log: Logger,
): Promise<PushOutcome> {
  const tokens = (
    await deps.db
      .select({ token: staffDevice.token })
      .from(staffDevice)
      .where(
        and(eq(staffDevice.userId, row.recipient), eq(staffDevice.active, true)),
      )
  ).map((device) => device.token);

  if (tokens.length === 0) {
    const attempts = row.attempts + 1;
    if (attempts < MAX_ATTEMPTS) {
      await deps.db
        .update(outboxMessage)
        .set({
          attempts,
          lastError: "no active device",
          nextAttemptAt: plusSeconds(now, backoffSeconds(attempts)),
          updatedAt: now,
        })
        .where(eq(outboxMessage.id, row.id));
      return "retried";
    }
    const queued = await fallbackPushToWhatsApp(deps, row, now, "no active device");
    log.warn("no device accepted the push; the alert fell back to WhatsApp", {
      recipient: row.recipient,
    });
    return queued ? "fellBack" : "failed";
  }

  try {
    const link = typeof row.values.link === "string" ? row.values.link : "";
    const tickets = await deps.push.send(
      tokens.map((token) => ({
        to: token,
        title: pushTitle(row),
        body,
        data: link ? { link } : undefined,
      })),
    );

    const invalid = tickets.filter((ticket) => ticket.invalid).map((t) => t.token);
    if (invalid.length > 0) {
      await deps.db
        .update(staffDevice)
        .set({ active: false, updatedAt: now })
        .where(inArray(staffDevice.token, invalid));
    }

    if (tickets.some((ticket) => ticket.ok)) {
      await deps.db
        .update(outboxMessage)
        .set({ status: "sent", lastError: null, updatedAt: now })
        .where(eq(outboxMessage.id, row.id));
      log.info("push alert sent", {
        devices: tickets.filter((ticket) => ticket.ok).length,
      });
      return "sent";
    }
    throw new Error(
      tickets.find((ticket) => ticket.error)?.error ?? "push rejected",
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const attempts = row.attempts + 1;
    const detail = error.message.slice(0, 500);
    if (attempts < MAX_ATTEMPTS) {
      await deps.db
        .update(outboxMessage)
        .set({
          attempts,
          lastError: detail,
          nextAttemptAt: plusSeconds(now, backoffSeconds(attempts)),
          updatedAt: now,
        })
        .where(eq(outboxMessage.id, row.id));
      log.warn("push send failed; will retry", { attempts, err: error });
      return "retried";
    }
    const queued = await fallbackPushToWhatsApp(deps, row, now, detail);
    log.warn("push failed for good; the alert fell back to WhatsApp", {
      attempts,
      err: error,
    });
    return queued ? "fellBack" : "failed";
  }
}

/** Queues the same alert to the person's WhatsApp number; returns whether it could. */
async function fallbackPushToWhatsApp(
  deps: OutboxDeps,
  row: OutboxRow,
  now: Date,
  detail: string,
): Promise<boolean> {
  const [user] = await deps.db
    .select({ active: staffUser.active, phone: staffUser.notifyPhone })
    .from(staffUser)
    .where(eq(staffUser.id, row.recipient))
    .limit(1);

  await deps.db
    .update(outboxMessage)
    .set({
      status: "failed",
      attempts: MAX_ATTEMPTS,
      lastError: `push: ${detail}`,
      updatedAt: now,
    })
    .where(eq(outboxMessage.id, row.id));

  if (!user?.active || !user.phone) {
    deps.logger.error("push alert has no WhatsApp fallback", {
      recipient: row.recipient,
      detail,
    });
    return false;
  }

  await deps.db.insert(outboxMessage).values({
    bookingId: row.bookingId,
    recipient: user.phone,
    channel: "whatsapp",
    template: row.template,
    values: row.values,
    locale: row.locale,
    status: "queued",
    attempts: 0,
    nextAttemptAt: now,
    expiresAt: row.expiresAt,
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

async function finish(
  deps: OutboxDeps,
  id: number,
  status: "failed",
  lastError: string,
  attempts?: number,
): Promise<void> {  await deps.db
    .update(outboxMessage)
    .set({
      status,
      lastError,
      ...(attempts === undefined ? {} : { attempts }),
      updatedAt: deps.clock.now(),
    })
    .where(eq(outboxMessage.id, id));
}

async function fallBackToSms(
  db: Pick<Database, "update">,
  id: number,
  now: Date,
  lastError: string,
): Promise<void> {
  await db
    .update(outboxMessage)
    .set({
      channel: "sms",
      status: "queued",
      attempts: 0,
      nextAttemptAt: now,
      lastError,
      updatedAt: now,
    })
    .where(eq(outboxMessage.id, id));
}

// ---------------------------------------------------------------------------
// Delivery status from the provider (the Twilio webhook)

export type DeliveryOutcome =
  "unknown-message" | "delivered" | "fell-back" | "failed" | "ignored";

/**
 * Applies a provider status to the message it is about. `delivered` and `read`
 * mark it delivered; `undelivered` and `failed` send a WhatsApp message again
 * by SMS, or mark an SMS failed. Anything else, and anything that no longer
 * matches the message's state (a repeated or out-of-order callback), is ignored.
 */
export async function applyProviderStatus(
  deps: Pick<OutboxDeps, "db" | "clock" | "logger">,
  providerMessageId: string,
  providerStatus: string,
): Promise<DeliveryOutcome> {
  const now = deps.clock.now();
  return deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(outboxMessage)
      .where(eq(outboxMessage.providerMessageId, providerMessageId))
      .for("update");
    if (!row) return "unknown-message";

    if (providerStatus === "delivered" || providerStatus === "read") {
      if (row.status !== "sent" && row.status !== "queued") return "ignored";
      // A message already waiting to fall back to SMS arrived after all: the
      // status wins, so the customer is not sent it twice.
      await tx
        .update(outboxMessage)
        .set({ status: "delivered", lastError: null, updatedAt: now })
        .where(eq(outboxMessage.id, row.id));
      return "delivered";
    }

    if (providerStatus === "undelivered" || providerStatus === "failed") {
      if (row.status !== "sent") return "ignored";
      if (row.channel === "whatsapp") {
        await fallBackToSms(
          tx,
          row.id,
          now,
          `whatsapp ${providerStatus} (provider status)`,
        );
        deps.logger.info("whatsapp not delivered; queued SMS fallback", {
          outboxId: row.id,
        });
        return "fell-back";
      }
      await tx
        .update(outboxMessage)
        .set({
          status: "failed",
          lastError: `sms ${providerStatus} (provider status)`,
          updatedAt: now,
        })
        .where(eq(outboxMessage.id, row.id));
      deps.logger.error("message not delivered by SMS", {
        outboxId: row.id,
        template: row.template,
      });
      return "failed";
    }

    return "ignored";
  });
}
