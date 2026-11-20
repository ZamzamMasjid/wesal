// SPEC: docs/features/public-calendar — five slot states; a held booking blocks only until its deadline; a near free slot is call-only
// ROADMAP: phase-3-booking / public-calendar / Implement availability API: slot states for a date range with expiry by timestamp
import { describe, expect, it } from "vitest";

import {
  actionFor,
  blockingState,
  rangesOverlap,
  type BookingRange,
  type SlotState,
} from "./slots";

const at = (iso: string) => new Date(iso);

// Friday 2026-12-25, 18:00-20:00 Cairo (16:00-18:00 UTC).
const slot = {
  startsAt: at("2026-12-25T16:00:00Z"),
  endsAt: at("2026-12-25T18:00:00Z"),
};
const now = at("2026-12-20T10:00:00Z");

const booking = (overrides: Partial<BookingRange> = {}): BookingRange => ({
  startsAt: at("2026-12-25T16:00:00Z"),
  endsAt: at("2026-12-25T18:00:00Z"),
  status: "confirmed",
  holdExpiresAt: at("2026-12-20T10:20:00Z"),
  ...overrides,
});

describe("rangesOverlap", () => {
  it("is true only when the ranges share more than an edge", () => {
    expect(rangesOverlap(slot, booking())).toBe(true);
    expect(
      rangesOverlap(slot, {
        startsAt: at("2026-12-25T17:00:00Z"),
        endsAt: at("2026-12-25T19:00:00Z"),
      }),
    ).toBe(true);
    expect(
      rangesOverlap(slot, {
        startsAt: at("2026-12-25T18:00:00Z"),
        endsAt: at("2026-12-25T20:00:00Z"),
      }),
    ).toBe(false);
    expect(
      rangesOverlap(slot, {
        startsAt: at("2026-12-25T14:00:00Z"),
        endsAt: at("2026-12-25T16:00:00Z"),
      }),
    ).toBe(false);
  });
});

describe("blockingState", () => {
  it("is free when nothing overlaps", () => {
    expect(blockingState([], slot, now)).toBeNull();
    expect(
      blockingState(
        [
          booking({
            startsAt: at("2026-12-25T18:00:00Z"),
            endsAt: at("2026-12-25T20:00:00Z"),
          }),
        ],
        slot,
        now,
      ),
    ).toBeNull();
  });

  it("maps each active status to the state a visitor sees", () => {
    const state = (status: BookingRange["status"]) =>
      blockingState([booking({ status })], slot, now);
    expect(state("confirmed")).toBe("confirmed");
    expect(state("proof_submitted")).toBe("awaiting_review");
    expect(state("held")).toBe("awaiting_payment");
  });

  it("stops a held booking from blocking once its deadline has passed", () => {
    const hold = (deadline: Date | null) =>
      blockingState(
        [booking({ status: "held", holdExpiresAt: deadline })],
        slot,
        now,
      );
    expect(hold(at("2026-12-20T10:20:00Z"))).toBe("awaiting_payment");
    expect(hold(at("2026-12-20T10:00:00Z"))).toBeNull();
    expect(hold(null)).toBeNull();
  });

  it("keeps confirmed ahead of review ahead of payment when ranges collide", () => {
    const held = booking({
      status: "held",
      holdExpiresAt: at("2026-12-20T10:20:00Z"),
    });
    const review = booking({ status: "proof_submitted" });
    const confirmed = booking({ status: "confirmed" });
    expect(blockingState([held, review, confirmed], slot, now)).toBe(
      "confirmed",
    );
    expect(blockingState([held, review], slot, now)).toBe("awaiting_review");
    expect(blockingState([held], slot, now)).toBe("awaiting_payment");
  });
});

describe("actionFor", () => {
  const state = (value: SlotState) => actionFor(value, slot.startsAt, now, 120);

  it("offers no action on a taken or closed slot", () => {
    expect(state("confirmed")).toBe("none");
    expect(state("awaiting_payment")).toBe("none");
    expect(state("awaiting_review")).toBe("none");
    expect(state("closed")).toBe("none");
  });

  it("books a free slot far enough away", () => {
    expect(actionFor("free", at("2026-12-21T10:00:01Z"), now, 120)).toBe(
      "book",
    );
  });

  it("asks for a call inside the cutoff or after the start", () => {
    expect(actionFor("free", at("2026-12-20T11:59:00Z"), now, 120)).toBe(
      "call",
    );
    expect(actionFor("free", at("2026-12-20T10:00:00Z"), now, 120)).toBe(
      "none",
    );
    expect(actionFor("free", at("2026-12-20T09:00:00Z"), now, 120)).toBe(
      "none",
    );
  });
});
