import { and, desc, eq, gt, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { recordAudit } from "@/audit/audit";
import type { Caller } from "@/api/caller";
import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { booking, occasion, paymentProof } from "@/db/schema";
import { cairoParts } from "@/lib/cairo-time";
import { normalizeBookingId } from "@/lib/booking-read-api";
import { closeSlotAlerts, notifySlotAlerts } from "@/ops/alerts/notify";
import {
  orderReviewQueue,
  REJECT_REASONS,
  type ReviewDetail,
  type ReviewDecision,
  type ReviewProof,
  type ReviewQueue,
  type ReviewQueueItem,
} from "@/lib/review-api";
import { publicBaseUrl } from "@/messaging/config";

import { effectiveStatus } from "./read";

// Payment review (docs/features/payment-review): the queue of proofs waiting
// for a person, and the three actions that decide one. Every decision runs in
// one transaction with its audit row, so a decision is never recorded without
// the change it describes. A row lock makes two staff acting at once safe: the
// second sees the status the first left and is refused.

export interface ReviewDeps {
  db: Database;
  /** Public origin, for the links in slot-alert messages. */
  baseUrl: string;
}

function actorId(caller: Caller): string {
  if (caller.kind !== "staff") throw new ApiError("UNAUTHENTICATED");
  return caller.userId;
}

function notFound(): ApiError {
  return new ApiError("NOT_FOUND", "No booking with that number.");
}

function statusChanged(status: string): ApiError {
  return new ApiError(
    "BOOKING_STATUS_CHANGED",
    `This booking is now ${status}.`,
    { status },
  );
}

function proofRowsToMap(
  rows: {
    id: number;
    bookingId: number;
    receivedVia: "upload" | "whatsapp";
    uploadedAt: Date;
    purgedAt: Date | null;
  }[],
): Map<number, { proofs: ReviewProof[]; newest: ReviewProof | null }> {
  const map = new Map<
    number,
    { proofs: ReviewProof[]; newest: ReviewProof | null }
  >();
  for (const row of rows) {
    const proof: ReviewProof = {
      id: row.id,
      receivedVia: row.receivedVia,
      uploadedAt: row.uploadedAt.toISOString(),
      purgedAt: row.purgedAt ? row.purgedAt.toISOString() : null,
    };
    const entry = map.get(row.bookingId) ?? { proofs: [], newest: null };
    entry.proofs.push(proof);
    entry.newest ??= proof;
    map.set(row.bookingId, entry);
  }
  return map;
}

const bookingIdInput = z.object({
  bookingId: z.string().trim().min(1).max(200),
});

export function createReviewOperations(resolve: () => ReviewDeps) {
  const queue = defineOperation({
    name: "staff.review.queue",
    access: "staff",
    input: z.object({}),
    handler: async (_input, ctx): Promise<ReviewQueue> => {
      const { db } = resolve();
      const now = ctx.clock.now();

      // Awaiting review, plus urgent holds for visibility. A held row past its
      // deadline is expired by ADR-010 and is not shown: nobody can act on it.
      const rows = await db
        .select({
          id: booking.id,
          publicId: booking.publicId,
          status: booking.status,
          urgent: booking.urgent,
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          priceEgp: booking.priceEgp,
          depositEgp: booking.depositEgp,
          holdExpiresAt: booking.holdExpiresAt,
          createdAt: booking.createdAt,
          occasionNameAr: occasion.nameAr,
          occasionNameEn: occasion.nameEn,
        })
        .from(booking)
        .innerJoin(occasion, eq(booking.occasionId, occasion.id))
        .where(
          or(
            eq(booking.status, "proof_submitted"),
            and(
              eq(booking.status, "held"),
              eq(booking.urgent, true),
              gt(booking.holdExpiresAt, now),
            ),
          ),
        );

      const ids = rows.map((row) => row.id);
      const proofs =
        ids.length === 0
          ? []
          : await db
              .select({
                id: paymentProof.id,
                bookingId: paymentProof.bookingId,
                receivedVia: paymentProof.receivedVia,
                uploadedAt: paymentProof.uploadedAt,
                purgedAt: paymentProof.purgedAt,
              })
              .from(paymentProof)
              .where(inArray(paymentProof.bookingId, ids))
              .orderBy(desc(paymentProof.uploadedAt), desc(paymentProof.id));

      const byBooking = proofRowsToMap(proofs);
      const items: ReviewQueueItem[] = rows.map((row) => {
        const entry = byBooking.get(row.id);
        const proofs = entry?.proofs ?? [];
        const first = proofs.at(-1);
        const start = cairoParts(row.startsAt);
        const end = cairoParts(row.endsAt);
        return {
          id: row.id,
          bookingId: row.publicId,
          status: row.status as "held" | "proof_submitted",
          urgent: row.urgent,
          occasion: {
            nameAr: row.occasionNameAr,
            nameEn: row.occasionNameEn,
          },
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          day: start.day,
          start: start.time,
          end: end.time,
          priceEgp: row.priceEgp,
          depositEgp: row.depositEgp,
          // A proof_submitted row waits from its first proof; a held row waits
          // from the moment it was created.
          waitingSince: first?.uploadedAt ?? row.createdAt.toISOString(),
          deadlineAt: row.holdExpiresAt
            ? row.holdExpiresAt.toISOString()
            : null,
          proof: entry?.newest ?? null,
          proofCount: proofs.length,
        };
      });

      return {
        items: orderReviewQueue(items),
        refreshedAt: now.toISOString(),
      };
    },
  });

  // One booking with every proof, newest first. It answers for a booking in any
  // state so a page opened after someone else decided can say so and link back.
  const get = defineOperation({
    name: "staff.review.get",
    access: "staff",
    input: bookingIdInput,
    handler: async (input, ctx): Promise<ReviewDetail> => {
      const { db } = resolve();
      const now = ctx.clock.now();
      const bookingId = normalizeBookingId(input.bookingId);
      if (bookingId === "") throw notFound();

      const [row] = await db
        .select({
          id: booking.id,
          publicId: booking.publicId,
          status: booking.status,
          urgent: booking.urgent,
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          priceEgp: booking.priceEgp,
          depositEgp: booking.depositEgp,
          holdExpiresAt: booking.holdExpiresAt,
          createdAt: booking.createdAt,
          occasionNameAr: occasion.nameAr,
          occasionNameEn: occasion.nameEn,
        })
        .from(booking)
        .innerJoin(occasion, eq(booking.occasionId, occasion.id))
        .where(eq(booking.publicId, bookingId))
        .limit(1);

      if (!row) throw notFound();

      const proofs = await db
        .select({
          id: paymentProof.id,
          receivedVia: paymentProof.receivedVia,
          uploadedAt: paymentProof.uploadedAt,
          purgedAt: paymentProof.purgedAt,
        })
        .from(paymentProof)
        .where(eq(paymentProof.bookingId, row.id))
        .orderBy(desc(paymentProof.uploadedAt), desc(paymentProof.id));

      const status = effectiveStatus(row.status, row.holdExpiresAt, now);
      const start = cairoParts(row.startsAt);
      const end = cairoParts(row.endsAt);

      return {
        id: row.id,
        bookingId: row.publicId,
        status,
        urgent: row.urgent,
        occasion: {
          nameAr: row.occasionNameAr,
          nameEn: row.occasionNameEn,
        },
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        day: start.day,
        start: start.time,
        end: end.time,
        priceEgp: row.priceEgp,
        depositEgp: row.depositEgp,
        remainderEgp: Math.max(0, row.priceEgp - row.depositEgp),
        createdAt: row.createdAt.toISOString(),
        deadlineAt: row.holdExpiresAt ? row.holdExpiresAt.toISOString() : null,
        proofs: proofs.map((proof) => ({
          ...proof,
          uploadedAt: proof.uploadedAt.toISOString(),
          purgedAt: proof.purgedAt ? proof.purgedAt.toISOString() : null,
        })),
      };
    },
  });

  type Locked =
    | {
        ok: true;
        id: number;
        publicId: string;
        status: string;
        startsAt: Date;
        endsAt: Date;
      }
    | { ok: false; error: ApiError };

  /**
   * Locks the booking and returns the status a reviewer should act on. An
   * overdue hold is stamped expired before the refusal, so the stored row
   * matches the answer even when the sweep has not run (ADR-010). The refusal is
   * returned rather than thrown: it must commit the expiry stamp.
   */
  async function lockForDecision(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    bookingId: string,
    now: Date,
  ): Promise<Locked> {
    const [row] = await tx
      .select({
        id: booking.id,
        publicId: booking.publicId,
        status: booking.status,
        holdExpiresAt: booking.holdExpiresAt,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
      })
      .from(booking)
      .where(eq(booking.publicId, bookingId))
      .for("update");
    if (!row) throw notFound();

    const status = effectiveStatus(row.status, row.holdExpiresAt, now);
    if (status === "expired" && row.status === "held") {
      await tx
        .update(booking)
        .set({ status: "expired", updatedAt: now })
        .where(eq(booking.id, row.id));
      // The stored expiry frees the slot, so tell anyone watching it.
      await notifySlotAlerts(
        tx,
        { now: () => now },
        row,
        resolve().baseUrl,
      );
    }
    if (status !== "proof_submitted") {
      return { ok: false, error: statusChanged(status) };
    }
    return {
      ok: true,
      id: row.id,
      publicId: row.publicId,
      status,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    };
  }

  const confirm = defineOperation({
    name: "staff.review.confirm",
    access: "staff",
    input: bookingIdInput,
    handler: async (input, ctx): Promise<ReviewDecision> => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      const now = ctx.clock.now();
      const bookingId = normalizeBookingId(input.bookingId);
      if (bookingId === "") throw notFound();

      const outcome = await db.transaction(async (tx) => {
        const locked = await lockForDecision(tx, bookingId, now);
        if (!locked.ok) return locked;
        await tx
          .update(booking)
          .set({ status: "confirmed", holdExpiresAt: null, updatedAt: now })
          .where(eq(booking.id, locked.id));
        // A confirmed slot cannot free up; any watch on it ends here.
        await closeSlotAlerts(tx, {
          startsAt: locked.startsAt,
          endsAt: locked.endsAt,
        });
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: "booking.confirm",
          target: `booking:${locked.publicId}`,
          bookingId: locked.id,
          detail: { from: locked.status, to: "confirmed" },
        });
        return {
          ok: true as const,
          data: {
            bookingId: locked.publicId,
            status: "confirmed" as const,
          },
        };
      });
      if (!outcome.ok) throw outcome.error;
      return outcome.data;
    },
  });

  const reject = defineOperation({
    name: "staff.review.reject",
    access: "staff",
    input: bookingIdInput.extend({
      reason: z.enum(REJECT_REASONS),
      note: z
        .string()
        .trim()
        .max(500)
        .nullable()
        .optional()
        .transform((value) => (value ? value : null)),
    }),
    handler: async (input, ctx): Promise<ReviewDecision> => {
      const { db, baseUrl } = resolve();
      const actor = actorId(ctx.caller);
      const now = ctx.clock.now();
      const bookingId = normalizeBookingId(input.bookingId);
      if (bookingId === "") throw notFound();

      const outcome = await db.transaction(async (tx) => {
        const locked = await lockForDecision(tx, bookingId, now);
        if (!locked.ok) return locked;
        // Rejecting frees the slot at once: `rejected` is not an active status,
        // so the exclusion constraint stops guarding this range.
        await tx
          .update(booking)
          .set({ status: "rejected", holdExpiresAt: null, updatedAt: now })
          .where(eq(booking.id, locked.id));
        await notifySlotAlerts(
          tx,
          ctx.clock,
          { startsAt: locked.startsAt, endsAt: locked.endsAt },
          baseUrl,
        );
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: "booking.reject",
          target: `booking:${locked.publicId}`,
          bookingId: locked.id,
          detail: {
            from: locked.status,
            to: "rejected",
            reason: input.reason,
            ...(input.note ? { note: input.note } : {}),
          },
        });
        return {
          ok: true as const,
          data: {
            bookingId: locked.publicId,
            status: "rejected" as const,
          },
        };
      });
      if (!outcome.ok) throw outcome.error;
      return outcome.data;
    },
  });

  // A screenshot that arrived over WhatsApp. It stops the countdown and joins
  // the queue, with no file to show; the same step may also confirm it.
  const proofReceived = defineOperation({
    name: "staff.review.proofReceived",
    access: "staff",
    input: bookingIdInput.extend({
      confirm: z.boolean().default(false),
    }),
    handler: async (input, ctx): Promise<ReviewDecision> => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      const now = ctx.clock.now();
      const bookingId = normalizeBookingId(input.bookingId);
      if (bookingId === "") throw notFound();

      const outcome = await db.transaction(async (tx) => {
        const [row] = await tx
          .select({
            id: booking.id,
            publicId: booking.publicId,
            status: booking.status,
            holdExpiresAt: booking.holdExpiresAt,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
          })
          .from(booking)
          .where(eq(booking.publicId, bookingId))
          .for("update");
        if (!row) throw notFound();

        const status = effectiveStatus(row.status, row.holdExpiresAt, now);
        if (status === "expired" && row.status === "held") {
          await tx
            .update(booking)
            .set({ status: "expired", updatedAt: now })
            .where(eq(booking.id, row.id));
        }
        if (status !== "held") {
          return { ok: false as const, error: statusChanged(status) };
        }

        const [proof] = await tx
          .insert(paymentProof)
          .values({
            bookingId: row.id,
            filePath: null,
            receivedVia: "whatsapp",
            uploadedAt: now,
          })
          .returning({ id: paymentProof.id });
        if (!proof) throw new ApiError("INTERNAL", "Proof not written.");

        const nextStatus: ReviewDecision["status"] = input.confirm
          ? "confirmed"
          : "proof_submitted";
        await tx
          .update(booking)
          .set({
            status: nextStatus,
            holdExpiresAt: null,
            updatedAt: now,
          })
          .where(eq(booking.id, row.id));

        if (nextStatus === "confirmed") {
          await closeSlotAlerts(tx, {
            startsAt: row.startsAt,
            endsAt: row.endsAt,
          });
        }

        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: "booking.proof_received",
          target: `booking:${row.publicId}`,
          bookingId: row.id,
          detail: {
            via: "whatsapp",
            proofId: proof.id,
            confirmed: input.confirm,
          },
        });
        if (input.confirm) {
          await recordAudit(tx, ctx.clock, {
            actorId: actor,
            action: "booking.confirm",
            target: `booking:${row.publicId}`,
            bookingId: row.id,
            detail: { from: "held", to: "confirmed", withProofReceived: true },
          });
        }

        return {
          ok: true as const,
          data: {
            bookingId: row.publicId,
            status: nextStatus,
            proofId: proof.id,
          },
        };
      });
      if (!outcome.ok) throw outcome.error;
      return outcome.data;
    },
  });

  return { queue, get, confirm, reject, proofReceived };
}

export const reviewOperations = createReviewOperations(() => ({
  db: getDb(),
  baseUrl: publicBaseUrl(),
}));

export type { ReviewDetail, ReviewDecision, ReviewQueue, ReviewQueueItem };
