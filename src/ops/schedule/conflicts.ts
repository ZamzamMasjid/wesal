import type { Database } from "@/db/client";
import { cairoParts } from "@/lib/cairo-time";

import { sameSlot, type ResolvedDay, type Slot } from "./resolver";

// The schedule-edit guard (docs/features/slot-schedule, "Edge cases"): an edit
// that would remove or change a slot on a date with an active booking is
// refused. The check is pure; only finding the bookings touches the database.

export interface ScheduleBooking {
  id: number;
  startsAt: Date;
  endsAt: Date;
}

/** Active (held, proof submitted or confirmed) bookings starting at or after `from`. */
export type ActiveBookingFinder = (
  db: Pick<Database, "select">,
  from: Date,
) => Promise<ScheduleBooking[]>;

/**
 * There is no booking table until phase 3 (`booking-hold`), so nothing can
 * conflict yet. `booking-hold` replaces this with a query on the booking table
 * and passes it to `createScheduleOperations`.
 */
export const noBookingsYet: ActiveBookingFinder = async () => [];

export interface BookingConflict {
  id: number;
  startsAt: string;
  endsAt: string;
}

function sameSlots(a: Slot[], b: Slot[]): boolean {
  return a.length === b.length && a.every((s, i) => sameSlot(s, b[i]!));
}

/**
 * The bookings an edit would strand. `before` and `after` resolve a date to its
 * slots under the old and new schedule. A date whose slots do not change is
 * unaffected; on a date that does change, a booking must still match one of the
 * new slots exactly.
 */
export function findConflicts(
  bookings: ScheduleBooking[],
  before: (day: string) => ResolvedDay,
  after: (day: string) => ResolvedDay,
): BookingConflict[] {
  const conflicts: BookingConflict[] = [];
  for (const booking of bookings) {
    const start = cairoParts(booking.startsAt);
    const end = cairoParts(booking.endsAt);
    const was = before(start.day);
    const next = after(start.day);
    if (was.closed === next.closed && sameSlots(was.slots, next.slots))
      continue;
    const stillFits =
      !next.closed &&
      next.slots.some((s) => sameSlot(s, { start: start.time, end: end.time }));
    if (!stillFits) {
      conflicts.push({
        id: booking.id,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
      });
    }
  }
  return conflicts.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
