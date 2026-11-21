import { and, eq, isNull, lte, or } from "drizzle-orm";

import type { Database } from "@/db/client";
import { booking } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { notifySlotAlerts } from "@/ops/alerts/notify";

// The tidy-up sweep (docs/architecture/flows.md, flow 3). It is housekeeping
// only: every read already compares the deadline with the clock (ADR-010), so a
// slot is free the moment its hold expires whether or not this has run. Marking
// the stored status keeps the dashboard and reports truthful, and the same
// transaction tells anyone watching the slot that it freed up.

export interface SweepDeps {
  db: Database;
  clock: Clock;
  /** Public origin, for the links in slot-alert messages. */
  baseUrl: string;
}

export interface SweepSummary {
  expired: number;
  /** Watchers told that an expired slot is free. */
  notified: number;
}

/** Marks every held booking whose deadline has passed as expired. */
export async function expireOverdueHolds(
  deps: SweepDeps,
): Promise<SweepSummary> {
  const now = deps.clock.now();
  return deps.db.transaction(async (tx) => {
    const rows = await tx
      .update(booking)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(booking.status, "held"),
          or(isNull(booking.holdExpiresAt), lte(booking.holdExpiresAt, now)),
        ),
      )
      .returning({
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
      });

    let notified = 0;
    for (const row of rows) {
      notified += await notifySlotAlerts(tx, deps.clock, row, deps.baseUrl);
    }
    return { expired: rows.length, notified };
  });
}
