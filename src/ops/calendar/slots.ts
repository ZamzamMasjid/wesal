// The public calendar's slot states (docs/features/public-calendar). Pure: given
// the bookings that overlap a slot, the current time and the near-slot cutoff,
// decide the state a visitor sees and what they may do with it.

/** The five states in the spec. `closed` is a whole date, never a single slot. */
export type SlotState =
  "free" | "awaiting_payment" | "awaiting_review" | "confirmed" | "closed";

/** What the visitor can do: book online, call because the slot is near, or nothing. */
export type SlotAction = "book" | "call" | "none";

/** The booking columns availability reads. Nothing here ever reaches the browser. */
export interface BookingRange {
  startsAt: Date;
  endsAt: Date;
  status: "held" | "proof_submitted" | "confirmed";
  holdExpiresAt: Date | null;
}

export function rangesOverlap(
  a: { startsAt: Date; endsAt: Date },
  b: { startsAt: Date; endsAt: Date },
): boolean {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

/**
 * A held booking counts only until its deadline: readers compare the deadline
 * with the clock, so a slot is free the moment the hold expires even if the
 * sweep has not run (ADR-010). `confirmed` outranks `proof_submitted`, which
 * outranks `held`; normally only one active booking can overlap a slot.
 */
export function blockingState(
  bookings: BookingRange[],
  slot: { startsAt: Date; endsAt: Date },
  now: Date,
): "awaiting_payment" | "awaiting_review" | "confirmed" | null {
  let best: "awaiting_payment" | "awaiting_review" | "confirmed" | null = null;
  const rank = {
    awaiting_payment: 1,
    awaiting_review: 2,
    confirmed: 3,
  } as const;
  for (const booking of bookings) {
    if (!rangesOverlap(booking, slot)) continue;
    if (
      booking.status === "held" &&
      (!booking.holdExpiresAt ||
        booking.holdExpiresAt.getTime() <= now.getTime())
    ) {
      continue;
    }
    const state =
      booking.status === "confirmed"
        ? "confirmed"
        : booking.status === "proof_submitted"
          ? "awaiting_review"
          : "awaiting_payment";
    if (!best || rank[state] > rank[best]) best = state;
  }
  return best;
}

/**
 * A free slot can be booked online only when it is far enough away. A slot that
 * has already started, and one inside the near-slot cutoff, cannot be held; the
 * page offers the venue's phone and WhatsApp instead.
 */
export function actionFor(
  state: SlotState,
  startsAt: Date,
  now: Date,
  nearSlotCutoffMinutes: number,
): SlotAction {
  if (state !== "free") return "none";
  const minutesAway = (startsAt.getTime() - now.getTime()) / 60_000;
  if (minutesAway <= 0) return "none";
  if (minutesAway < nearSlotCutoffMinutes) return "call";
  return "book";
}
