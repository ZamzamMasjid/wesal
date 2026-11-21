import { randomBytes, randomInt } from "node:crypto";

import { and, eq, gt, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { isExclusionViolation, isUniqueViolation } from "@/db/pg-error";
import { booking, occasion } from "@/db/schema";
import { absoluteBookingLink, type BookingLocale } from "@/lib/booking-link";
import { cairoInstant, isValidDay } from "@/lib/cairo-time";
import { verificationSecret } from "@/lib/verification-secret";
import { publicBaseUrl } from "@/messaging/config";
import { queueMessage } from "@/messaging/outbox";
import { queueStaffAlert } from "@/messaging/staff-alerts";
import { resolveSlots, sameSlot } from "@/ops/schedule/resolver";
import { depositFor, loadSettings } from "@/ops/venue/settings";
import { isE164, normalizePhone } from "@/ops/verification/phone";
import { verifyVerifiedPhoneToken } from "@/ops/verification/token";

// The hold endpoint (docs/features/booking-hold). One transaction creates the
// reservation: it expires any overdue hold on the range, refuses a second hold
// for the same phone, inserts, and queues the booking-link message. The database
// exclusion constraint (migration 0009) decides a race between two customers;
// the loser gets SLOT_TAKEN. Time always comes from the injected clock.

/** Six characters customers read aloud, without look-alikes (I/O/0/1). */
const PUBLIC_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PUBLIC_ID_LENGTH = 6;
const ID_ATTEMPTS = 5;

export interface HoldCreated {
  bookingId: string;
  linkToken: string;
  deadlineAt: string;
  priceEgp: number;
  depositEgp: number;
  urgent: boolean;
}

const minutes = 60_000;

/**
 * When a hold stops blocking its slot. Normally `holdMinutes` after creation,
 * but never later than the near-slot cutoff before the slot starts, so a hold on
 * a soon slot cannot outlive the moment staff need to act on it.
 */
export function holdDeadline(
  now: Date,
  startsAt: Date,
  holdMinutes: number,
  nearSlotCutoffMinutes: number,
): Date {
  return new Date(
    Math.min(
      now.getTime() + holdMinutes * minutes,
      startsAt.getTime() - nearSlotCutoffMinutes * minutes,
    ),
  );
}

/** A hold on a slot starting inside the urgent threshold is flagged for staff. */
export function isUrgent(
  now: Date,
  startsAt: Date,
  urgentThresholdMinutes: number,
): boolean {
  return startsAt.getTime() - now.getTime() <= urgentThresholdMinutes * minutes;
}

export function generatePublicId(): string {
  let id = "";
  for (let i = 0; i < PUBLIC_ID_LENGTH; i++) {
    id += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  }
  return id;
}

/** The unguessable secret in the private booking page's link. */
export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time written HH:MM.");

export const createHoldInput = z
  .object({
    day: z.string().refine(isValidDay, "Use a real date written YYYY-MM-DD."),
    start: time,
    end: time,
    occasionId: z.coerce.number().int().positive(),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(1).max(30),
    /** The verified-phone token from `verification.check`. */
    token: z.string().min(1).max(1000),
    locale: z.enum(["ar", "en"]).default("ar"),
  })
  .refine((value) => value.start < value.end, {
    path: ["end"],
    message: "The end must be after the start.",
  });

export interface HoldDeps {
  db: Database;
  /** HMAC key for verified-phone tokens. */
  secret: string;
  /** Public origin, for the link in the queued message. */
  baseUrl: string;
}

const ID_CONSTRAINTS = [
  "booking_public_id_unique",
  "booking_access_token_unique",
];

export function createBookingOperations(resolve: () => HoldDeps) {
  const create = defineOperation({
    name: "bookings.create",
    access: "anonymous",
    input: createHoldInput,
    handler: async (input, ctx): Promise<HoldCreated> => {
      const deps = resolve();
      const now = ctx.clock.now();
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

      // The token proves control of this phone; it is checked before anything
      // else so a forged request never reaches the booking rules (ADR-016).
      if (!verifyVerifiedPhoneToken(input.token, phone, now, deps.secret)) {
        throw new ApiError(
          "PHONE_NOT_VERIFIED",
          "Verify the phone number again.",
        );
      }

      const [settings, resolved] = await Promise.all([
        loadSettings(deps.db),
        resolveSlots(deps.db, input.day),
      ]);

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
      if (startsAt.getTime() <= now.getTime()) {
        throw new ApiError(
          "SLOT_UNAVAILABLE",
          "That slot has already started.",
          { reason: "past" },
        );
      }
      const minutesAway = (startsAt.getTime() - now.getTime()) / minutes;
      if (minutesAway < settings.nearSlotCutoffMinutes) {
        throw new ApiError(
          "SLOT_UNAVAILABLE",
          "This slot is too soon to book online.",
          { reason: "near_slot" },
        );
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

      const deadline = holdDeadline(
        now,
        startsAt,
        settings.holdMinutes,
        settings.nearSlotCutoffMinutes,
      );
      const urgent = isUrgent(now, startsAt, settings.urgentThresholdMinutes);
      const depositEgp = depositFor(chosen.priceEgp, settings.depositPercent);
      const locale: BookingLocale = input.locale;

      for (let attempt = 0; attempt < ID_ATTEMPTS; attempt++) {
        const publicId = generatePublicId();
        const accessToken = generateAccessToken();
        try {
          await deps.db.transaction(async (tx) => {
            // One hold per phone at a time. The lock serialises two submits from
            // the same phone so the check below cannot be bypassed by a race.
            await tx.execute(
              sql`select pg_advisory_xact_lock(hashtext(${phone}))`,
            );

            const overdue = and(
              eq(booking.status, "held"),
              or(
                isNull(booking.holdExpiresAt),
                lte(booking.holdExpiresAt, now),
              ),
            );
            // ADR-010: a hold past its deadline is free, whether the sweep has
            // run or not, so expire the row before asking the constraint.
            await tx
              .update(booking)
              .set({ status: "expired", updatedAt: now })
              .where(
                and(
                  overdue,
                  lt(booking.startsAt, endsAt),
                  gt(booking.endsAt, startsAt),
                ),
              );
            await tx
              .update(booking)
              .set({ status: "expired", updatedAt: now })
              .where(and(overdue, eq(booking.customerPhone, phone)));

            const [existing] = await tx
              .select({ publicId: booking.publicId })
              .from(booking)
              .where(
                and(
                  eq(booking.status, "held"),
                  eq(booking.customerPhone, phone),
                  gt(booking.holdExpiresAt, now),
                ),
              )
              .limit(1);
            if (existing) {
              throw new ApiError(
                "PHONE_HOLD_EXISTS",
                "This phone already has a hold.",
                { bookingId: existing.publicId },
              );
            }

            const [row] = await tx
              .insert(booking)
              .values({
                publicId,
                accessToken,
                occasionId: chosen.id,
                startsAt,
                endsAt,
                status: "held",
                source: "online",
                customerName: input.name,
                customerPhone: phone,
                locale,
                priceEgp: chosen.priceEgp,
                depositEgp,
                holdExpiresAt: deadline,
                urgent,
                createdAt: now,
                updatedAt: now,
              })
              .returning({ id: booking.id });

            if (!row) throw new ApiError("INTERNAL", "Booking not written.");

            await queueMessage(tx, ctx.clock, {
              template: "booking-link",
              recipient: phone,
              values: {
                link: absoluteBookingLink(deps.baseUrl, locale, accessToken),
                deadlineAt: deadline.toISOString(),
              },
              locale,
              bookingId: row.id,
              // The text names the deadline; after it passes the message would
              // be misleading, so the outbox drops it instead of sending late.
              expiresAt: deadline,
            });

            // A hold on a slot starting soon is announced the moment it is
            // created, so staff know to watch for the proof (staff-notifications).
            if (urgent) {
              await queueStaffAlert(tx, ctx.clock, {
                kind: "urgent",
                booking: {
                  id: row.id,
                  publicId,
                  customerName: input.name,
                  occasionNameAr: chosen.nameAr,
                  occasionNameEn: chosen.nameEn,
                  startsAt,
                  depositEgp,
                },
                baseUrl: deps.baseUrl,
                logger: ctx.log,
              });
            }
          });

          return {
            bookingId: publicId,
            linkToken: accessToken,
            deadlineAt: deadline.toISOString(),
            priceEgp: chosen.priceEgp,
            depositEgp,
            urgent,
          };
        } catch (error) {
          if (error instanceof ApiError) throw error;
          if (isExclusionViolation(error)) {
            throw new ApiError(
              "SLOT_TAKEN",
              "Another customer is booking this slot.",
            );
          }
          if (isUniqueViolation(error, ID_CONSTRAINTS)) continue;
          throw error;
        }
      }

      throw new ApiError("INTERNAL", "Could not allocate a booking id.");
    },
  });

  return { create };
}

export const bookingOperations = createBookingOperations(() => ({
  db: getDb(),
  secret: verificationSecret(),
  baseUrl: publicBaseUrl(),
}));
