import { and, eq, isNull, lte, or } from "drizzle-orm";

import type { Database } from "@/db/client";
import { booking } from "@/db/schema";
import type { Clock } from "@/lib/clock";

// The tidy-up sweep (docs/architecture/flows.md, flow 3). It is housekeeping
// only: every read already compares the deadline with the clock (ADR-010), so a
// slot is free the moment its hold expires whether or not this has run. Marking
// the stored status keeps the dashboard and reports truthful.

export interface SweepDeps {
  db: Database;
  clock: Clock;
}

export interface SweepSummary {
  expired: number;
}

/** Marks every held booking whose deadline has passed as expired. */
export async function expireOverdueHolds(
  deps: SweepDeps,
): Promise<SweepSummary> {
  const now = deps.clock.now();
  const rows = await deps.db
    .update(booking)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(booking.status, "held"),
        or(isNull(booking.holdExpiresAt), lte(booking.holdExpiresAt, now)),
      ),
    )
    .returning({ id: booking.id });
  return { expired: rows.length };
}
