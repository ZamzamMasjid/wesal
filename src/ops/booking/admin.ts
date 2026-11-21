import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { recordAudit } from "@/audit/audit";
import type { Caller } from "@/api/caller";
import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { isExclusionViolation, isUniqueViolation } from "@/db/pg-error";
import {
  auditLog,
  booking,
  occasion,
  paymentProof,
  staffUser,
} from "@/db/schema";
import { absoluteBookingLink, type BookingLocale } from "@/lib/booking-link";
import {
  BOOKINGS_PAGE_SIZE,
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  type AdminBookingDetail,
  type AdminBookingHistoryEntry,
  type AdminBookingListItem,
  type AdminBookingStatus,
  type AdminHistoryAction,
  type BookingsPage,
} from "@/lib/booking-admin-api";
import {
  addDays,
  cairoInstant,
  cairoDay,
  cairoParts,
  isValidDay,
} from "@/lib/cairo-time";
import { normalizeBookingId } from "@/lib/booking-read-api";
import { publicBaseUrl } from "@/messaging/config";
import { queueMessage } from "@/messaging/outbox";
import { resolveSlots, sameSlot } from "@/ops/schedule/resolver";
import { isE164, normalizePhone } from "@/ops/verification/phone";

import { generateAccessToken, generatePublicId } from "./hold";
import { effectiveStatus } from "./read";

// Booking management (docs/features/booking-management): the full list, manual
// entry for phone and walk-in bookings, cancellation and the remainder mark.
// Manual entries go through the same exclusion constraint as customer holds —
// there is no override — and every mutation writes its audit row in the same
// transaction as the change it describes.

const ACTIVE_STATUSES = ["held", "proof_submitted", "confirmed"] as const;

const ID_CONSTRAINTS = [
  "booking_public_id_unique",
  "booking_access_token_unique",
];

const ID_ATTEMPTS = 5;

export interface AdminBookingDeps {
  db: Database;
  /** Public origin, for the link in the booking-confirmed message. */
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

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time written HH:MM.");

const day = z
  .string()
  .refine(isValidDay, "Use a real date written YYYY-MM-DD.");

const listInput = z
  .object({
    from: day.optional(),
    to: day.optional(),
    status: z.enum(BOOKING_STATUSES).optional(),
    source: z.enum(BOOKING_SOURCES).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "The end of the range must not be before its start.",
  });

const bookingIdInput = z.object({
  bookingId: z.string().trim().min(1).max(200),
});

const createInput = z
  .object({
    day,
    start: time,
    end: time,
    occasionId: z.coerce.number().int().positive(),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(1).max(30),
    /** The language of the customer's booking-confirmed message. */
    locale: z.enum(["ar", "en"]).default("ar"),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .refine((value) => value.start < value.end, {
    path: ["end"],
    message: "The end must be after the start.",
  });

/** A stored `held` row past its deadline is `expired` when filtering (ADR-010). */
function statusCondition(status: AdminBookingStatus, now: Date): SQL {
  if (status === "held") {
    return and(
      eq(booking.status, "held"),
      gt(booking.holdExpiresAt, now),
    ) as SQL;
  }
  if (status === "expired") {
    return or(
      eq(booking.status, "expired"),
      and(
        eq(booking.status, "held"),
        or(isNull(booking.holdExpiresAt), lte(booking.holdExpiresAt, now)),
      ),
    ) as SQL;
  }
  return eq(booking.status, status);
}

/** Escapes LIKE wildcards, so a search for "50%" matches the text. */
export function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function searchCondition(query: string): SQL {
  const pattern = likePattern(query);
  const digits = query.replace(/\D/g, "");
  const phone = normalizePhone(query);
  const phoneMatches: SQL[] = [];
  if (isE164(phone))
    phoneMatches.push(ilike(booking.customerPhone, likePattern(phone)));
  if (digits.length >= 4) {
    phoneMatches.push(ilike(booking.customerPhone, likePattern(digits)));
  }
  return or(
    ilike(booking.customerName, pattern),
    ilike(booking.publicId, likePattern(query.toUpperCase())),
    ...phoneMatches,
  ) as SQL;
}

function toListItem(
  row: {
    id: number;
    publicId: string;
    status: (typeof booking.$inferSelect)["status"];
    source: (typeof booking.$inferSelect)["source"];
    occasionNameAr: string;
    occasionNameEn: string;
    customerName: string;
    customerPhone: string;
    startsAt: Date;
    endsAt: Date;
    priceEgp: number;
    depositEgp: number;
    holdExpiresAt: Date | null;
    remainderPaid: boolean;
    createdAt: Date;
  },
  now: Date,
): AdminBookingListItem {
  const start = cairoParts(row.startsAt);
  const end = cairoParts(row.endsAt);
  return {
    id: row.id,
    bookingId: row.publicId,
    status: effectiveStatus(row.status, row.holdExpiresAt, now),
    source: row.source,
    occasion: { nameAr: row.occasionNameAr, nameEn: row.occasionNameEn },
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    day: start.day,
    start: start.time,
    end: end.time,
    priceEgp: row.priceEgp,
    depositEgp: row.depositEgp,
    remainderEgp: Math.max(0, row.priceEgp - row.depositEgp),
    remainderPaid: row.remainderPaid,
    createdAt: row.createdAt.toISOString(),
  };
}

const AUDIT_ACTIONS: Record<string, AdminHistoryAction> = {
  "booking.enter": "created",
  "booking.proof_received": "proof_received",
  "booking.confirm": "confirmed",
  "booking.reject": "rejected",
  "booking.cancel": "cancelled",
  "booking.remainder_paid": "remainder_paid",
};

function auditNote(action: string, detail: Record<string, unknown> | null) {
  if (!detail) return undefined;
  if (action === "booking.cancel" && typeof detail.reason === "string") {
    return detail.reason;
  }
  if (action === "booking.enter" && typeof detail.note === "string") {
    return detail.note;
  }
  return undefined;
}

export function createAdminBookingOperations(resolve: () => AdminBookingDeps) {
  const list = defineOperation({
    name: "staff.bookings.list",
    access: "staff",
    input: listInput,
    handler: async (input, ctx): Promise<BookingsPage> => {
      const { db } = resolve();
      const now = ctx.clock.now();
      const today = cairoDay(now);

      const conditions: SQL[] = [];
      if (input.from) {
        conditions.push(
          gte(booking.startsAt, cairoInstant(input.from, "00:00")),
        );
      } else if (!input.to) {
        // The default view is upcoming, not "everything ever".
        conditions.push(gte(booking.startsAt, now));
      }
      if (input.to) {
        conditions.push(
          lt(booking.startsAt, cairoInstant(addDays(input.to, 1), "00:00")),
        );
      }
      if (input.status) {
        conditions.push(statusCondition(input.status, now));
      }
      if (input.source) conditions.push(eq(booking.source, input.source));
      if (input.q) conditions.push(searchCondition(input.q));

      const where = conditions.length ? and(...conditions) : undefined;
      const offset = (input.page - 1) * BOOKINGS_PAGE_SIZE;
      // A past range reads newest first; an upcoming or open range soonest first.
      const ascending = !input.to || input.to >= today;

      const [rows, [totals]] = await Promise.all([
        db
          .select({
            id: booking.id,
            publicId: booking.publicId,
            status: booking.status,
            source: booking.source,
            occasionNameAr: occasion.nameAr,
            occasionNameEn: occasion.nameEn,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            priceEgp: booking.priceEgp,
            depositEgp: booking.depositEgp,
            holdExpiresAt: booking.holdExpiresAt,
            remainderPaid: booking.remainderPaid,
            createdAt: booking.createdAt,
          })
          .from(booking)
          .innerJoin(occasion, eq(booking.occasionId, occasion.id))
          .where(where)
          .orderBy(
            ascending ? asc(booking.startsAt) : desc(booking.startsAt),
            asc(booking.id),
          )
          .limit(BOOKINGS_PAGE_SIZE)
          .offset(offset),
        db
          .select({ total: count() })
          .from(booking)
          .innerJoin(occasion, eq(booking.occasionId, occasion.id))
          .where(where),
      ]);

      return {
        items: rows.map((row) => toListItem(row, now)),
        total: Number(totals?.total ?? 0),
        page: input.page,
        pageSize: BOOKINGS_PAGE_SIZE,
        refreshedAt: now.toISOString(),
      };
    },
  });

  // One booking with its proofs and the merged story of what happened to it:
  // customer events (created, proof uploaded) from the booking and proof rows,
  // staff actions from the audit trail. It answers in any state.
  const detail = defineOperation({
    name: "staff.bookings.detail",
    access: "staff",
    input: bookingIdInput,
    handler: async (input, ctx): Promise<AdminBookingDetail> => {
      const { db } = resolve();
      const now = ctx.clock.now();
      const bookingId = normalizeBookingId(input.bookingId);
      if (bookingId === "") throw notFound();

      const [row] = await db
        .select({
          id: booking.id,
          publicId: booking.publicId,
          status: booking.status,
          source: booking.source,
          occasionNameAr: occasion.nameAr,
          occasionNameEn: occasion.nameEn,
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          priceEgp: booking.priceEgp,
          depositEgp: booking.depositEgp,
          holdExpiresAt: booking.holdExpiresAt,
          remainderPaid: booking.remainderPaid,
          createdAt: booking.createdAt,
        })
        .from(booking)
        .innerJoin(occasion, eq(booking.occasionId, occasion.id))
        .where(eq(booking.publicId, bookingId))
        .limit(1);
      if (!row) throw notFound();

      const [proofs, audits] = await Promise.all([
        db
          .select({
            id: paymentProof.id,
            receivedVia: paymentProof.receivedVia,
            uploadedAt: paymentProof.uploadedAt,
            purgedAt: paymentProof.purgedAt,
          })
          .from(paymentProof)
          .where(eq(paymentProof.bookingId, row.id))
          .orderBy(desc(paymentProof.uploadedAt), desc(paymentProof.id)),
        db
          .select({
            id: auditLog.id,
            action: auditLog.action,
            detail: auditLog.detail,
            at: auditLog.at,
            actorName: staffUser.name,
          })
          .from(auditLog)
          .innerJoin(staffUser, eq(staffUser.id, auditLog.actorId))
          .where(eq(auditLog.bookingId, row.id))
          .orderBy(asc(auditLog.id)),
      ]);

      const events: { entry: AdminBookingHistoryEntry; order: number }[] =
        audits.flatMap((entry) => {
          const action = AUDIT_ACTIONS[entry.action];
          if (!action) return [];
          const note = auditNote(entry.action, entry.detail);
          return [
            {
              entry: {
                at: entry.at.toISOString(),
                actor: "staff" as const,
                actorName: entry.actorName,
                action,
                ...(note ? { note } : {}),
              },
              order: entry.id,
            },
          ];
        });

      // An online booking was created by its customer; a staff entry already has
      // its `booking.enter` audit row above. Customer uploads are not audit rows.
      if (row.source === "online") {
        events.push({
          entry: {
            at: row.createdAt.toISOString(),
            actor: "customer",
            action: "created",
          },
          order: 0,
        });
      }
      for (const proof of proofs) {
        if (proof.receivedVia !== "upload") continue;
        events.push({
          entry: {
            at: proof.uploadedAt.toISOString(),
            actor: "customer",
            action: "proof_uploaded",
          },
          order: 0,
        });
      }

      return {
        ...toListItem(row, now),
        proofs: proofs.map((proof) => ({
          id: proof.id,
          receivedVia: proof.receivedVia,
          uploadedAt: proof.uploadedAt.toISOString(),
          purgedAt: proof.purgedAt ? proof.purgedAt.toISOString() : null,
        })),
        history: events
          .sort(
            (a, b) =>
              Date.parse(a.entry.at) - Date.parse(b.entry.at) ||
              a.order - b.order,
          )
          .map((event) => event.entry),
      };
    },
  });

  // A caller or walk-in: no held state, no deposit step in the system, and no
  // verified phone — staff vouch for the caller. The booking starts confirmed.
  const create = defineOperation({
    name: "staff.bookings.create",
    access: "staff",
    input: createInput,
    handler: async (input, ctx) => {
      const deps = resolve();
      const now = ctx.clock.now();
      const actor = actorId(ctx.caller);
      const phone = normalizePhone(input.phone);
      if (!isE164(phone)) {
        throw new ApiError("VALIDATION_FAILED", "Enter a valid phone number.", {
          issues: [
            {
              path: "phone",
              code: "invalid_format",
              message: "Invalid phone.",
            },
          ],
        });
      }

      const resolved = await resolveSlots(deps.db, input.day);
      if (resolved.closed) {
        throw new ApiError(
          "SLOT_UNAVAILABLE",
          "The venue is closed on this date.",
          { reason: "closed" },
        );
      }
      if (!resolved.slots.some((slot) => sameSlot(slot, input))) {
        throw new ApiError("SLOT_UNAVAILABLE", "That slot is not offered.", {
          reason: "missing",
        });
      }

      const startsAt = cairoInstant(input.day, input.start);
      const endsAt = cairoInstant(input.day, input.end);
      // A walk-in can be entered while its slot is running, but not after it
      // ended: booking a past event would change nothing the calendar shows.
      if (endsAt.getTime() <= now.getTime()) {
        throw new ApiError("SLOT_UNAVAILABLE", "That slot has already ended.", {
          reason: "past",
        });
      }

      const [chosen] = await deps.db
        .select({
          id: occasion.id,
          nameAr: occasion.nameAr,
          nameEn: occasion.nameEn,
          priceEgp: occasion.priceEgp,
        })
        .from(occasion)
        .where(
          and(eq(occasion.id, input.occasionId), eq(occasion.active, true)),
        );
      if (!chosen) {
        throw new ApiError(
          "OCCASION_UNAVAILABLE",
          "That occasion is not offered.",
        );
      }

      const locale: BookingLocale = input.locale;

      for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
        const publicId = generatePublicId();
        const accessToken = generateAccessToken();
        try {
          await deps.db.transaction(async (tx) => {
            // ADR-010: an overdue hold is free, so expire it before the
            // constraint is asked. This is the same transaction shape as a
            // customer hold; the database decides a race.
            await tx
              .update(booking)
              .set({ status: "expired", updatedAt: now })
              .where(
                and(
                  eq(booking.status, "held"),
                  or(
                    isNull(booking.holdExpiresAt),
                    lte(booking.holdExpiresAt, now),
                  ),
                  lt(booking.startsAt, endsAt),
                  gt(booking.endsAt, startsAt),
                ),
              );

            const [row] = await tx
              .insert(booking)
              .values({
                publicId,
                accessToken,
                occasionId: chosen.id,
                startsAt,
                endsAt,
                status: "confirmed",
                source: "staff",
                customerName: input.name,
                customerPhone: phone,
                locale,
                priceEgp: chosen.priceEgp,
                // Whether a deposit was taken offline is free text on the audit
                // row; the system holds no deposit for a manual booking.
                depositEgp: 0,
                holdExpiresAt: null,
                urgent: false,
                createdAt: now,
                updatedAt: now,
              })
              .returning({ id: booking.id });
            if (!row) throw new ApiError("INTERNAL", "Booking not written.");

            await queueMessage(tx, ctx.clock, {
              template: "booking-confirmed",
              recipient: phone,
              values: {
                link: absoluteBookingLink(deps.baseUrl, locale, accessToken),
              },
              locale,
              bookingId: row.id,
            });

            await recordAudit(tx, ctx.clock, {
              actorId: actor,
              action: "booking.enter",
              target: `booking:${publicId}`,
              bookingId: row.id,
              detail: {
                source: "staff",
                from: null,
                to: "confirmed",
                occasionId: chosen.id,
                priceEgp: chosen.priceEgp,
                depositEgp: 0,
                ...(input.note ? { note: input.note } : {}),
              },
            });
          });

          return {
            bookingId: publicId,
            day: input.day,
            start: input.start,
            end: input.end,
            priceEgp: chosen.priceEgp,
            depositEgp: 0,
          };
        } catch (error) {
          if (error instanceof ApiError) throw error;
          if (isExclusionViolation(error)) {
            throw new ApiError(
              "SLOT_TAKEN",
              "This slot already has an active booking.",
              { holder: await findHolder(deps.db, startsAt, endsAt, now) },
            );
          }
          if (isUniqueViolation(error, ID_CONSTRAINTS)) continue;
          throw error;
        }
      }

      throw new ApiError("INTERNAL", "Could not allocate a booking id.");
    },
  });

  const cancel = defineOperation({
    name: "staff.bookings.cancel",
    access: "staff",
    input: bookingIdInput.extend({
      reason: z.string().trim().min(1).max(500),
    }),
    handler: async (input, ctx) => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      const now = ctx.clock.now();
      const bookingId = normalizeBookingId(input.bookingId);
      if (bookingId === "") throw notFound();

      const outcome = await db.transaction(async (tx) => {
        const locked = await lockForAction(tx, bookingId, now);
        if (!locked.ok) return locked;
        // Only a confirmed booking is cancelled; held and awaiting-review rows
        // end by expiry or rejection.
        if (locked.status !== "confirmed") {
          return { ok: false as const, error: statusChanged(locked.status) };
        }
        await tx
          .update(booking)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(booking.id, locked.id));
        await recordAudit(tx, ctx.clock, {
          actorId: actor,
          action: "booking.cancel",
          target: `booking:${locked.publicId}`,
          bookingId: locked.id,
          detail: { from: "confirmed", to: "cancelled", reason: input.reason },
        });
        return {
          ok: true as const,
          data: { bookingId: locked.publicId, status: "cancelled" as const },
        };
      });
      if (!outcome.ok) throw outcome.error;
      return outcome.data;
    },
  });

  const remainderPaid = defineOperation({
    name: "staff.bookings.remainderPaid",
    access: "staff",
    input: bookingIdInput,
    handler: async (input, ctx) => {
      const { db } = resolve();
      const actor = actorId(ctx.caller);
      const now = ctx.clock.now();
      const bookingId = normalizeBookingId(input.bookingId);
      if (bookingId === "") throw notFound();

      const outcome = await db.transaction(async (tx) => {
        const locked = await lockForAction(tx, bookingId, now);
        if (!locked.ok) return locked;
        if (locked.status !== "confirmed") {
          return { ok: false as const, error: statusChanged(locked.status) };
        }
        const amount = Math.max(0, locked.priceEgp - locked.depositEgp);
        // Marking a paid booking again changes nothing and writes no second row.
        if (!locked.remainderPaid) {
          await tx
            .update(booking)
            .set({ remainderPaid: true, updatedAt: now })
            .where(eq(booking.id, locked.id));
          await recordAudit(tx, ctx.clock, {
            actorId: actor,
            action: "booking.remainder_paid",
            target: `booking:${locked.publicId}`,
            bookingId: locked.id,
            detail: { amountEgp: amount },
          });
        }
        return {
          ok: true as const,
          data: {
            bookingId: locked.publicId,
            status: "confirmed" as const,
            remainderPaid: true,
          },
        };
      });
      if (!outcome.ok) throw outcome.error;
      return outcome.data;
    },
  });

  return { list, detail, create, cancel, remainderPaid };
}

type Locked =
  | {
      ok: true;
      id: number;
      publicId: string;
      status: AdminBookingStatus;
      priceEgp: number;
      depositEgp: number;
      remainderPaid: boolean;
    }
  | { ok: false; error: ApiError };

/**
 * Locks the booking and returns the status a staff action should act on. An
 * overdue hold is stamped expired before the refusal so the stored row matches
 * the answer even when the sweep has not run (ADR-010). The refusal is returned
 * rather than thrown because it must commit the expiry stamp.
 */
async function lockForAction(
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
      priceEgp: booking.priceEgp,
      depositEgp: booking.depositEgp,
      remainderPaid: booking.remainderPaid,
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
  return {
    ok: true,
    id: row.id,
    publicId: row.publicId,
    status,
    priceEgp: row.priceEgp,
    depositEgp: row.depositEgp,
    remainderPaid: row.remainderPaid,
  };
}

/** The active booking that now owns a range, for the SLOT_TAKEN details. */
async function findHolder(
  db: Database,
  startsAt: Date,
  endsAt: Date,
  now: Date,
) {
  const [row] = await db
    .select({
      publicId: booking.publicId,
      status: booking.status,
      holdExpiresAt: booking.holdExpiresAt,
      customerName: booking.customerName,
    })
    .from(booking)
    .where(
      and(
        inArray(booking.status, ACTIVE_STATUSES),
        lt(booking.startsAt, endsAt),
        gt(booking.endsAt, startsAt),
        or(ne(booking.status, "held"), gt(booking.holdExpiresAt, now)),
      ),
    )
    .orderBy(asc(booking.id))
    .limit(1);
  if (!row) return null;
  return {
    bookingId: row.publicId,
    status: effectiveStatus(row.status, row.holdExpiresAt, now),
    customerName: row.customerName,
    deadlineAt: row.holdExpiresAt ? row.holdExpiresAt.toISOString() : null,
  };
}

export const adminBookingOperations = createAdminBookingOperations(() => ({
  db: getDb(),
  baseUrl: publicBaseUrl(),
}));

export type { AdminBookingDetail, AdminBookingListItem, BookingsPage };
