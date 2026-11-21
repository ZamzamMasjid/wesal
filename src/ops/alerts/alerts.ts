import { randomBytes } from "node:crypto";

import { and, count, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { booking, slotAlert } from "@/db/schema";
import { cairoInstant, isValidDay } from "@/lib/cairo-time";
import { verificationSecret } from "@/lib/verification-secret";
import { resolveSlots, sameSlot } from "@/ops/schedule/resolver";
import { isE164, normalizePhone } from "@/ops/verification/phone";
import { verifyVerifiedPhoneToken } from "@/ops/verification/token";

// Slot alerts (docs/features/slot-alerts): a visitor watching a slot that is
// awaiting payment or review asks to be told if it frees up. Signing up costs a
// verified phone (the same token a hold uses); nothing is reserved. The outbox
// notification itself is queued by `notify.ts` when the booking frees the slot.

/** How many unnotified subscriptions one phone may hold. */
export const MAX_ACTIVE_ALERTS_PER_PHONE = 5;

const ALERTABLE_STATUSES = ["held", "proof_submitted"] as const;

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time written HH:MM.");

const day = z
  .string()
  .refine(isValidDay, "Use a real date written YYYY-MM-DD.");

export const createAlertInput = z
  .object({
    day,
    start: time,
    end: time,
    phone: z.string().trim().min(1).max(30),
    /** The verified-phone token from `verification.check`. */
    token: z.string().min(1).max(1000),
    locale: z.enum(["ar", "en"]).default("ar"),
  })
  .refine((value) => value.start < value.end, {
    path: ["end"],
    message: "The end must be after the start.",
  });

export const unsubscribeAlertInput = z.object({
  token: z.string().trim().min(1).max(200),
});

export interface AlertDeps {
  db: Database;
  /** HMAC key for verified-phone tokens. */
  secret: string;
}

/** The unguessable secret in the unsubscribe link. */
export function generateAlertToken(): string {
  return randomBytes(18).toString("base64url");
}

export function createAlertOperations(resolve: () => AlertDeps) {
  const create = defineOperation({
    name: "alerts.create",
    access: "anonymous",
    input: createAlertInput,
    handler: async (input, ctx) => {
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

      // The token proves control of this phone. It is checked before the slot
      // rules so a forged request learns nothing about the calendar.
      if (!verifyVerifiedPhoneToken(input.token, phone, now, deps.secret)) {
        throw new ApiError(
          "PHONE_NOT_VERIFIED",
          "Verify the phone number again.",
        );
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
      if (startsAt.getTime() <= now.getTime()) {
        throw new ApiError(
          "SLOT_UNAVAILABLE",
          "That slot has already started.",
          { reason: "past" },
        );
      }

      // Only a slot that someone else is holding or that is awaiting review can
      // free up. A free or confirmed slot has nothing to watch.
      const [taken] = await deps.db
        .select({ id: booking.id, status: booking.status })
        .from(booking)
        .where(
          and(
            eq(booking.startsAt, startsAt),
            eq(booking.endsAt, endsAt),
            inArray(booking.status, ALERTABLE_STATUSES),
            or(
              eq(booking.status, "proof_submitted"),
              gt(booking.holdExpiresAt, now),
            ),
          ),
        )
        .limit(1);
      if (!taken) {
        throw new ApiError(
          "SLOT_UNAVAILABLE",
          "This slot is not waiting on anyone right now.",
          { reason: "not_taken" },
        );
      }

      const [existing] = await deps.db
        .select({ id: slotAlert.id })
        .from(slotAlert)
        .where(
          and(
            eq(slotAlert.phone, phone),
            eq(slotAlert.startsAt, startsAt),
            eq(slotAlert.endsAt, endsAt),
          ),
        )
        .limit(1);

      if (!existing) {
        const [row] = await deps.db
          .select({ total: count() })
          .from(slotAlert)
          .where(
            and(
              eq(slotAlert.phone, phone),
              isNull(slotAlert.notifiedAt),
              gt(slotAlert.startsAt, now),
            ),
          );
        if (Number(row?.total ?? 0) >= MAX_ACTIVE_ALERTS_PER_PHONE) {
          throw new ApiError(
            "ALERT_LIMIT_REACHED",
            "This phone is already watching as many slots as it may.",
            { limit: MAX_ACTIVE_ALERTS_PER_PHONE },
          );
        }
      }

      // Subscribing again (perhaps after being told once) starts a fresh watch:
      // a new unsubscribe secret and no notification stamp.
      const token = generateAlertToken();
      await deps.db
        .insert(slotAlert)
        .values({
          startsAt,
          endsAt,
          phone,
          locale: input.locale,
          token,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [slotAlert.phone, slotAlert.startsAt, slotAlert.endsAt],
          set: {
            locale: input.locale,
            token,
            notifiedAt: null,
          },
        });

      return { phone, subscribed: true };
    },
  });

  // The link in the message. Deleting an already-removed subscription is a
  // success: the visitor's intent (stop alerts) holds either way.
  const unsubscribe = defineOperation({
    name: "alerts.unsubscribe",
    access: "anonymous",
    input: unsubscribeAlertInput,
    handler: async (input) => {
      const deps = resolve();
      await deps.db.delete(slotAlert).where(eq(slotAlert.token, input.token));
      return { unsubscribed: true };
    },
  });

  return { create, unsubscribe };
}

export const alertOperations = createAlertOperations(() => ({
  db: getDb(),
  secret: verificationSecret(),
}));
