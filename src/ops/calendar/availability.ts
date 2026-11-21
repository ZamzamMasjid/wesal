import { and, gt, inArray, lt, ne, or } from "drizzle-orm";
import { z } from "zod";

import { defineOperation } from "@/api/operation";
import { getDb, type Database } from "@/db/client";
import { booking } from "@/db/schema";
import { addDays, cairoDay, cairoInstant, isValidDay } from "@/lib/cairo-time";
import { loadSettings } from "@/ops/venue/settings";
import { resolveRange } from "@/ops/schedule/resolver";

import {
  actionFor,
  blockingState,
  type BookingRange,
  type SlotAction,
  type SlotState,
} from "./slots";

// The availability API (docs/features/public-calendar): for each date in a
// range, whether it is closed and each slot's public state. It combines the
// slot resolver with active bookings; no customer detail ever leaves here. The
// calendar may be up to 30 seconds stale (ADR-014) — the hold endpoint still
// refuses a double booking.

/** A visitor loads a month at a time; two months is generous and stays cheap. */
export const AVAILABILITY_MAX_DAYS = 62;

const ACTIVE_STATUSES = ["held", "proof_submitted", "confirmed"] as const;

export interface PublicSlot {
  /** `HH:MM`, Africa/Cairo. */
  start: string;
  end: string;
  state: SlotState;
  action: SlotAction;
  /** Whether a visitor can ask to be told if this taken slot frees up. */
  alert: boolean;
}

export interface PublicDay {
  /** `YYYY-MM-DD`, Africa/Cairo. */
  day: string;
  closed: boolean;
  slots: PublicSlot[];
}

export interface Availability {
  from: string;
  to: string;
  /** The venue's date now; the page uses it to dim past days. */
  today: string;
  /** When these states were read, so the page can say they are fresh. */
  refreshedAt: string;
  days: PublicDay[];
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

const day = z
  .string()
  .refine(isValidDay, "Use a real date written YYYY-MM-DD.");

export const availabilityInput = z
  .object({ from: day, to: day })
  .refine((v) => v.from <= v.to, {
    path: ["to"],
    message: "The end of the range must not be before its start.",
  })
  .refine((v) => daysBetween(v.from, v.to) <= AVAILABILITY_MAX_DAYS, {
    path: ["to"],
    message: `Ask for at most ${AVAILABILITY_MAX_DAYS} days at a time.`,
  });

export interface CalendarDeps {
  db: Database;
}

/** The states of every slot in `[from, to]`, computed at `now`. */
export async function buildAvailability(
  db: Database,
  from: string,
  to: string,
  now: Date,
): Promise<Availability> {
  const [resolved, settings] = await Promise.all([
    resolveRange(db, from, to),
    loadSettings(db),
  ]);

  const rangeStart = cairoInstant(from, "00:00");
  const rangeEnd = cairoInstant(addDays(to, 1), "00:00");
  const rows = await db
    .select({
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      status: booking.status,
      holdExpiresAt: booking.holdExpiresAt,
    })
    .from(booking)
    .where(
      and(
        inArray(booking.status, ACTIVE_STATUSES),
        lt(booking.startsAt, rangeEnd),
        gt(booking.endsAt, rangeStart),
        // A held row blocks only while its deadline is in the future (ADR-010).
        or(ne(booking.status, "held"), gt(booking.holdExpiresAt, now)),
      ),
    );

  const active: BookingRange[] = rows.map((row) => ({
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status as BookingRange["status"],
    holdExpiresAt: row.holdExpiresAt,
  }));

  return {
    from,
    to,
    today: cairoDay(now),
    refreshedAt: now.toISOString(),
    days: resolved.map((resolvedDay) => ({
      day: resolvedDay.day,
      closed: resolvedDay.closed,
      slots: resolvedDay.slots.map((slot) => {
        const startsAt = cairoInstant(resolvedDay.day, slot.start);
        const endsAt = cairoInstant(resolvedDay.day, slot.end);
        const state =
          blockingState(active, { startsAt, endsAt }, now) ?? "free";
        return {
          start: slot.start,
          end: slot.end,
          state,
          action: actionFor(
            state,
            startsAt,
            now,
            settings.nearSlotCutoffMinutes,
          ),
          // Watching makes sense only while someone is holding or awaiting review
          // and the slot has not started yet.
          alert:
            (state === "awaiting_payment" || state === "awaiting_review") &&
            startsAt.getTime() > now.getTime(),
        };
      }),
    })),
  };
}

export function createCalendarOperations(resolve: () => CalendarDeps) {
  const availability = defineOperation({
    name: "availability.get",
    access: "anonymous",
    input: availabilityInput,
    handler: async (input, ctx) =>
      buildAvailability(resolve().db, input.from, input.to, ctx.clock.now()),
  });

  return { availability };
}

export const calendarOperations = createCalendarOperations(() => ({
  db: getDb(),
}));
