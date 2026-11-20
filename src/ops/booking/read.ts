import { eq } from "drizzle-orm";
import { z } from "zod";

import { ApiError } from "@/api/errors";
import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { booking, occasion } from "@/db/schema";
import {
  normalizeBookingId,
  type PublicBooking,
  type PublicBookingStatus,
} from "@/lib/booking-read-api";
import { cairoParts } from "@/lib/cairo-time";
import {
  createRateLimiter,
  type RateLimiter,
  type RateLimitRule,
} from "@/lib/rate-limit";
import { loadSettings } from "@/ops/venue/settings";

// Reading one booking as its holder may see it (docs/features/booking-page).
// The link token is the key; the booking ID is a second way in, rate-limited
// per IP because it is short enough to guess. A held booking past its deadline
// is reported expired without waiting for the sweep (ADR-010). Only what the
// holder needs is returned: no phone number, no other booking.

/** Ten tries a minute is generous for a family, useless for guessing. */
export const BOOKING_LOOKUP_RULE: RateLimitRule = {
  limit: 10,
  windowSeconds: 60,
};

const notFound = () =>
  new ApiError("NOT_FOUND", "No booking matches that number.");

type StoredStatus = (typeof booking.$inferSelect)["status"];

/**
 * The status a reader sees. A `held` row whose deadline has passed is expired
 * even when no job has stamped it (ADR-010).
 */
export function effectiveStatus(
  status: StoredStatus,
  holdExpiresAt: Date | null,
  now: Date,
): PublicBookingStatus {
  if (status !== "held") return status;
  if (!holdExpiresAt || holdExpiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "held";
}

/** The booking behind a link token, as its holder may see it. */
export async function buildPublicBooking(
  db: Database,
  token: string,
  now: Date,
): Promise<PublicBooking> {
  const [row] = await db
    .select({
      publicId: booking.publicId,
      status: booking.status,
      customerName: booking.customerName,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      priceEgp: booking.priceEgp,
      depositEgp: booking.depositEgp,
      holdExpiresAt: booking.holdExpiresAt,
      remainderPaid: booking.remainderPaid,
      createdAt: booking.createdAt,
      occasionNameAr: occasion.nameAr,
      occasionNameEn: occasion.nameEn,
    })
    .from(booking)
    .innerJoin(occasion, eq(booking.occasionId, occasion.id))
    .where(eq(booking.accessToken, token))
    .limit(1);

  if (!row) {
    throw new ApiError("NOT_FOUND", "No booking with that link.");
  }

  const status = effectiveStatus(row.status, row.holdExpiresAt, now);
  const start = cairoParts(row.startsAt);
  const end = cairoParts(row.endsAt);

  // Transfer details are shown only while the booking can still be paid.
  let transfer: PublicBooking["transfer"] = null;
  if (status === "held") {
    const settings = await loadSettings(db);
    transfer = {
      vodafoneCashNumber: settings.vodafoneCashNumber,
      instapayAddress: settings.instapayAddress,
    };
  }

  return {
    bookingId: row.publicId,
    status,
    occasion: { nameAr: row.occasionNameAr, nameEn: row.occasionNameEn },
    customerName: row.customerName,
    day: start.day,
    start: start.time,
    end: end.time,
    priceEgp: row.priceEgp,
    depositEgp: row.depositEgp,
    remainderEgp: Math.max(0, row.priceEgp - row.depositEgp),
    remainderPaid: row.remainderPaid,
    deadlineAt:
      status === "held" && row.holdExpiresAt
        ? row.holdExpiresAt.toISOString()
        : null,
    transfer,
    createdAt: row.createdAt.toISOString(),
    refreshedAt: now.toISOString(),
  };
}

const byTokenInput = z.object({
  token: z.string().trim().min(1).max(200),
});

const lookupInput = z.object({
  bookingId: z.string().trim().max(200).default(""),
});

export interface BookingReadDeps {
  db: Database;
  limiter: RateLimiter;
}

export function createBookingReadOperations(resolve: () => BookingReadDeps) {
  const byToken = defineOperation({
    name: "bookings.byToken",
    access: "holder",
    input: byTokenInput,
    handler: async (input, ctx): Promise<PublicBooking> =>
      buildPublicBooking(resolve().db, input.token, ctx.clock.now()),
  });

  const lookup = defineOperation({
    name: "bookings.lookup",
    access: "holder",
    input: lookupInput,
    handler: async (input, ctx) => {
      const deps = resolve();
      const now = ctx.clock.now();

      // Counted before the lookup so guessing is what gets limited. Without a
      // client address the limit is skipped rather than shared by everyone.
      if (ctx.ip) {
        const key = `booking-lookup:${ctx.ip}`;
        const wait = deps.limiter.retryAfter(key, BOOKING_LOOKUP_RULE, now);
        if (wait > 0) {
          throw new ApiError("RATE_LIMITED", "Too many lookups.", {
            retryAfterSeconds: wait,
          });
        }
        deps.limiter.record(key, BOOKING_LOOKUP_RULE, now);
      }

      // A malformed ID and an unknown one get the same answer.
      const bookingId = normalizeBookingId(input.bookingId);
      if (bookingId === "") throw notFound();

      const [row] = await deps.db
        .select({
          publicId: booking.publicId,
          accessToken: booking.accessToken,
        })
        .from(booking)
        .where(eq(booking.publicId, bookingId))
        .limit(1);

      if (!row) throw notFound();
      return { bookingId: row.publicId, token: row.accessToken };
    },
  });

  return { byToken, lookup };
}

// One limiter for the process: limits are per process, which is enough while
// `web` is one machine (docs/architecture/auth.md).
const lookupLimiter = createRateLimiter();

export const bookingReadOperations = createBookingReadOperations(() => ({
  db: getDb(),
  limiter: lookupLimiter,
}));
