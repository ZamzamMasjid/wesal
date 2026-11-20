// SPEC: docs/features/booking-page — the holder reads one booking by its link token, transfer details only while payable, and a held booking past its deadline is expired
// ROADMAP: phase-3-booking / booking-page / Implement booking read API by link token and rate-limited lookup by booking ID
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import { booking, occasion, settings } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { createRateLimiter } from "@/lib/rate-limit";
import { aBooking, anOccasion } from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

import {
  BOOKING_LOOKUP_RULE,
  createBookingReadOperations,
  effectiveStatus,
} from "./read";

const handle = openTestDb();
const { db } = handle;

const limiter = createRateLimiter();
const ops = createBookingReadOperations(() => ({ db, limiter }));

const NOW = new Date("2026-12-20T08:00:00Z");
let now = NOW;
const clock: Clock = { now: () => now };
const ctx = {
  ...createCallContext({ kind: "anonymous" }),
  clock,
  ip: "203.0.113.7",
};
const minutes = 60_000;

let occasionId = 1;

beforeEach(async () => {
  now = NOW;
  limiter.reset();
  await resetDatabase(handle);
  const [row] = await db
    .insert(occasion)
    .values(anOccasion({ nameAr: "زفاف", nameEn: "Wedding", priceEgp: 1000 }))
    .returning({ id: occasion.id });
  occasionId = row!.id;
});
afterAll(() => handle.pool.end());

async function seed(
  overrides: Partial<Parameters<typeof aBooking>[0]> = {},
): Promise<void> {
  await db.insert(booking).values(aBooking({ occasionId, ...overrides }));
}

async function setPaymentDetails(
  values: { vodafoneCash?: string | null; instapay?: string | null } = {},
): Promise<void> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  await db
    .update(settings)
    .set({
      vodafoneCashNumber: values.vodafoneCash ?? "01001234567",
      instapayAddress: values.instapay ?? "name@instapay",
    })
    .where(eq(settings.id, 1));
}

describe("bookings.byToken", () => {
  it("returns the booking as the holder may see it", async () => {
    await setPaymentDetails();
    await seed({
      publicId: "7K3M9Q",
      accessToken: "token-seven",
      customerName: "Mona Hassan",
    });

    const result = await ops.byToken({ token: "token-seven" }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      bookingId: "7K3M9Q",
      status: "held",
      occasion: { nameAr: "زفاف", nameEn: "Wedding" },
      customerName: "Mona Hassan",
      day: "2026-12-25",
      start: "18:00",
      end: "20:00",
      priceEgp: 1000,
      depositEgp: 500,
      remainderEgp: 500,
      remainderPaid: false,
      deadlineAt: "2026-12-25T16:20:00.000Z",
      transfer: {
        vodafoneCashNumber: "01001234567",
        instapayAddress: "name@instapay",
      },
      createdAt: expect.any(String),
      refreshedAt: NOW.toISOString(),
    });
  });

  it("reports a held booking past its deadline as expired, without payment details", async () => {
    await setPaymentDetails();
    await seed({
      accessToken: "token-late",
      holdExpiresAt: new Date(NOW.getTime() - minutes),
    });

    const result = await ops.byToken({ token: "token-late" }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("expired");
    expect(result.data.deadlineAt).toBeNull();
    expect(result.data.transfer).toBeNull();
  });

  it("stops the clock and hides transfer details once proof is in", async () => {
    await setPaymentDetails();
    await seed({ accessToken: "token-proof", status: "proof_submitted" });

    const result = await ops.byToken({ token: "token-proof" }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("proof_submitted");
    expect(result.data.deadlineAt).toBeNull();
    expect(result.data.transfer).toBeNull();
  });

  it("reports a confirmed booking with an unpaid and a paid balance", async () => {
    await seed({ accessToken: "token-due", status: "confirmed" });
    await seed({
      publicId: "PAID01",
      accessToken: "token-paid",
      status: "confirmed",
      remainderPaid: true,
      startsAt: new Date("2026-12-26T16:00:00Z"),
      endsAt: new Date("2026-12-26T18:00:00Z"),
    });

    const due = await ops.byToken({ token: "token-due" }, ctx);
    expect(due.ok && due.data.remainderEgp).toBe(500);
    expect(due.ok && due.data.remainderPaid).toBe(false);

    const paid = await ops.byToken({ token: "token-paid" }, ctx);
    expect(paid.ok && paid.data.remainderPaid).toBe(true);
  });

  it("returns NOT_FOUND for an unknown link and never another booking", async () => {
    await seed({ publicId: "REAL01", accessToken: "token-real" });

    const missing = await ops.byToken({ token: "token-other" }, ctx);
    expect(missing.ok ? undefined : missing.error.code).toBe("NOT_FOUND");

    const real = await ops.byToken({ token: "token-real" }, ctx);
    expect(real.ok && real.data.bookingId).toBe("REAL01");
  });

  it("does not expose the customer phone number", async () => {
    await seed({ accessToken: "token-private" });
    const result = await ops.byToken({ token: "token-private" }, ctx);
    expect(JSON.stringify(result)).not.toContain("+201001234567");
  });
});

describe("bookings.lookup", () => {
  beforeEach(async () => {
    await seed({ publicId: "7K3M9Q", accessToken: "token-seven" });
  });

  it("turns a booking ID into the link token, however it was typed", async () => {
    for (const typed of ["7k3m9q", "  7K3M9Q ", "7K3-M9Q"]) {
      const result = await ops.lookup({ bookingId: typed }, ctx);
      expect(result.ok).toBe(true);
      expect(result.ok && result.data).toEqual({
        bookingId: "7K3M9Q",
        token: "token-seven",
      });
    }
  });

  it("accepts Arabic-Indic digits", async () => {
    await seed({
      publicId: "123456",
      accessToken: "token-digits",
      startsAt: new Date("2026-12-26T16:00:00Z"),
      endsAt: new Date("2026-12-26T18:00:00Z"),
    });
    const result = await ops.lookup({ bookingId: "١٢٣٤٥٦" }, ctx);
    expect(result.ok && result.data.token).toBe("token-digits");
  });

  it("gives the same answer for a wrong ID and one that never existed", async () => {
    const wrong = await ops.lookup({ bookingId: "AAAAAA" }, ctx);
    const empty = await ops.lookup({ bookingId: "" }, ctx);
    const junk = await ops.lookup({ bookingId: "!!!" }, ctx);

    const errors = [wrong, empty, junk].map((result) =>
      result.ok
        ? null
        : { code: result.error.code, message: result.error.message },
    );
    expect(errors).toEqual([
      { code: "NOT_FOUND", message: "No booking matches that number." },
      { code: "NOT_FOUND", message: "No booking matches that number." },
      { code: "NOT_FOUND", message: "No booking matches that number." },
    ]);
  });

  it("rate-limits one address and leaves another alone", async () => {
    for (let attempt = 1; attempt <= BOOKING_LOOKUP_RULE.limit; attempt++) {
      const result = await ops.lookup({ bookingId: "7K3M9Q" }, ctx);
      expect(result.ok).toBe(true);
    }

    const limited = await ops.lookup({ bookingId: "7K3M9Q" }, ctx);
    expect(limited.ok ? undefined : limited.error.code).toBe("RATE_LIMITED");
    expect(
      limited.ok ? undefined : limited.error.details?.retryAfterSeconds,
    ).toBeGreaterThan(0);

    const elsewhere = await ops.lookup(
      { bookingId: "7K3M9Q" },
      { ...ctx, ip: "198.51.100.9" },
    );
    expect(elsewhere.ok).toBe(true);
  });

  it("skips the limit when the address is unknown", async () => {
    const anonymousAddress = { ...ctx, ip: undefined };
    for (let attempt = 0; attempt < BOOKING_LOOKUP_RULE.limit + 5; attempt++) {
      const result = await ops.lookup(
        { bookingId: "7K3M9Q" },
        anonymousAddress,
      );
      expect(result.ok).toBe(true);
    }
  });
});

describe("effectiveStatus", () => {
  it("expires a held row only once its deadline is reached", () => {
    const deadline = new Date(NOW.getTime() + minutes);
    expect(effectiveStatus("held", deadline, NOW)).toBe("held");
    expect(effectiveStatus("held", new Date(NOW.getTime()), NOW)).toBe(
      "expired",
    );
    expect(effectiveStatus("held", null, NOW)).toBe("expired");
  });

  it("leaves every other status alone", () => {
    expect(effectiveStatus("confirmed", null, NOW)).toBe("confirmed");
    expect(effectiveStatus("rejected", null, NOW)).toBe("rejected");
  });
});
