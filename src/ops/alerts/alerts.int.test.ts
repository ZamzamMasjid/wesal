// SPEC: slot-alerts/spec.md — a visitor watches a taken slot after verifying their phone; one subscription per phone per slot, with a limit and an unsubscribe link
// ROADMAP: phase-6-alerts-and-reports / slot-alerts / Implement alert signup on a taken slot with phone verification
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import {
  booking,
  occasion,
  slotAlert,
  slotPattern,
} from "@/db/schema";
import type { Clock } from "@/lib/clock";
import {
  issueVerifiedPhoneToken,
  VERIFIED_PHONE_TOKEN_MINUTES,
} from "@/ops/verification/token";
import { aBooking, anOccasion, aSlotPattern } from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

import {
  createAlertOperations,
  MAX_ACTIVE_ALERTS_PER_PHONE,
} from "./alerts";

const handle = openTestDb();
const { db } = handle;

const SECRET = "slot-alert-test-secret";
const ops = createAlertOperations(() => ({ db, secret: SECRET }));

// Sunday 2026-12-20, 08:00 Cairo. The watched slot is Friday 25 December
// 18:00-20:00 Cairo (16:00-18:00 UTC).
const NOW = new Date("2026-12-20T08:00:00Z");
const PHONE = "+201001234567";
let now = NOW;
const clock: Clock = { now: () => now };
const ctx = { ...createCallContext({ kind: "anonymous" }), clock };

beforeEach(async () => {
  now = NOW;
  await resetDatabase(handle);
  await db
    .insert(slotPattern)
    .values(aSlotPattern({ weekday: 5, startTime: "18:00", endTime: "20:00" }));
  await db.insert(occasion).values(anOccasion({ priceEgp: 1000 }));
});
afterAll(() => handle.pool.end());

function tokenFor(phone = PHONE, issuedAt = now): string {
  return issueVerifiedPhoneToken(phone, issuedAt, SECRET).token;
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    day: "2026-12-25",
    start: "18:00",
    end: "20:00",
    phone: PHONE,
    token: tokenFor(),
    locale: "ar",
    ...overrides,
  };
}

async function heldBooking(
  overrides: Partial<Parameters<typeof aBooking>[0]> = {},
) {
  await db.insert(booking).values(
    aBooking({
      customerPhone: "+209990001111",
      holdExpiresAt: new Date("2026-12-20T09:00:00Z"),
      ...overrides,
    }),
  );
}

describe("alerts.create", () => {
  it("subscribes a verified phone to a slot that is awaiting payment", async () => {
    await heldBooking();

    const result = await ops.create(input(), ctx);

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toMatchObject({
      phone: PHONE,
      subscribed: true,
    });

    const [row] = await db.select().from(slotAlert);
    expect(row).toMatchObject({
      phone: PHONE,
      locale: "ar",
      notifiedAt: null,
    });
    expect(row?.startsAt).toEqual(new Date("2026-12-25T16:00:00Z"));
    expect(row?.endsAt).toEqual(new Date("2026-12-25T18:00:00Z"));
    expect(row?.token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  });

  it("accepts a booking that is awaiting review", async () => {
    await heldBooking({ status: "proof_submitted", holdExpiresAt: null });

    const result = await ops.create(input(), ctx);

    expect(result.ok).toBe(true);
    expect(await db.select().from(slotAlert)).toHaveLength(1);
  });

  it("refuses a forged or expired phone token", async () => {
    await heldBooking();
    const expired = issueVerifiedPhoneToken(
      PHONE,
      new Date(now.getTime() - (VERIFIED_PHONE_TOKEN_MINUTES + 1) * 60_000),
      SECRET,
    ).token;

    for (const token of ["v1.nope.nope", expired]) {
      const result = await ops.create(input({ token }), ctx);
      expect(result).toMatchObject({ ok: false });
      if (!result.ok) expect(result.error.code).toBe("PHONE_NOT_VERIFIED");
    }
    expect(await db.select().from(slotAlert)).toHaveLength(0);
  });

  it("refuses a token issued for another phone", async () => {
    await heldBooking();

    const result = await ops.create(
      input({ token: tokenFor("+201002223334") }),
      ctx,
    );

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error.code).toBe("PHONE_NOT_VERIFIED");
  });

  it("refuses a slot nobody is holding", async () => {
    // A confirmed booking has nothing to watch, and a free slot has no row.
    await heldBooking({ status: "confirmed", holdExpiresAt: null });

    const result = await ops.create(input(), ctx);

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.error.code).toBe("SLOT_UNAVAILABLE");
      expect(result.error.details).toMatchObject({ reason: "not_taken" });
    }
  });

  it("treats a hold past its deadline as free", async () => {
    await heldBooking({ holdExpiresAt: new Date("2026-12-20T07:59:00Z") });

    const result = await ops.create(input(), ctx);

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("refuses a slot that is not offered by the schedule", async () => {
    await heldBooking();

    const result = await ops.create(input({ start: "17:00" }), ctx);

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("keeps one subscription per phone and slot, refreshing it", async () => {
    await heldBooking();

    const first = await ops.create(input(), ctx);
    expect(first.ok).toBe(true);
    const [before] = await db.select().from(slotAlert);

    const again = await ops.create(input({ locale: "en" }), ctx);
    expect(again.ok).toBe(true);

    const rows = await db.select().from(slotAlert);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.locale).toBe("en");
    expect(rows[0]?.token).not.toBe(before?.token);
  });

  it("applies a limit to the slots one phone may watch", async () => {
    await heldBooking();
    await db.insert(slotAlert).values(
      Array.from({ length: MAX_ACTIVE_ALERTS_PER_PHONE }, (_, index) => ({
        startsAt: new Date(Date.UTC(2026, 11, 26 + index, 16)),
        endsAt: new Date(Date.UTC(2026, 11, 26 + index, 18)),
        phone: PHONE,
        locale: "ar" as const,
        token: `existing-${index}`,
      })),
    );

    const result = await ops.create(input(), ctx);

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.error.code).toBe("ALERT_LIMIT_REACHED");
      expect(result.error.details).toMatchObject({
        limit: MAX_ACTIVE_ALERTS_PER_PHONE,
      });
    }
  });

  it("lets a phone watch another slot when it already watches this one at the limit", async () => {
    await heldBooking();
    await db.insert(slotAlert).values(
      Array.from({ length: MAX_ACTIVE_ALERTS_PER_PHONE - 1 }, (_, index) => ({
        startsAt: new Date(Date.UTC(2026, 11, 26 + index, 16)),
        endsAt: new Date(Date.UTC(2026, 11, 26 + index, 18)),
        phone: PHONE,
        locale: "ar" as const,
        token: `existing-${index}`,
      })),
    );

    const result = await ops.create(input(), ctx);

    expect(result.ok).toBe(true);
    expect(await db.select().from(slotAlert)).toHaveLength(
      MAX_ACTIVE_ALERTS_PER_PHONE,
    );
  });
});

describe("alerts.unsubscribe", () => {
  it("removes the subscription behind the link", async () => {
    await heldBooking();
    await ops.create(input(), ctx);
    const [row] = await db.select().from(slotAlert);

    const result = await ops.unsubscribe({ token: row?.token ?? "" }, ctx);

    expect(result.ok).toBe(true);
    expect(await db.select().from(slotAlert)).toHaveLength(0);
  });

  it("is a success for a link that was already used", async () => {
    const result = await ops.unsubscribe({ token: "already-removed" }, ctx);

    expect(result).toMatchObject({ ok: true, data: { unsubscribed: true } });
  });
});
