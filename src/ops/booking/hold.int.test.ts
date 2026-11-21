// SPEC: docs/features/booking-hold — one transaction creates the hold, a phone has one held booking, an overdue hold is free, and two customers cannot hold one slot
// ROADMAP: phase-3-booking / booking-hold / Implement create-hold endpoint: verified phone, transaction, conflict error
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import {
  booking,
  dateException,
  occasion,
  outboxMessage,
  slotPattern,
  staffUser,
} from "@/db/schema";
import type { Clock } from "@/lib/clock";
import {
  issueVerifiedPhoneToken,
  VERIFIED_PHONE_TOKEN_MINUTES,
} from "@/ops/verification/token";
import {
  aBooking,
  anOccasion,
  aSlotPattern,
  aStaffUser,
} from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

import { createBookingOperations } from "./hold";

const handle = openTestDb();
const { db } = handle;

const SECRET = "booking-hold-test-secret";
const BASE_URL = "https://wesal.example";
const ops = createBookingOperations(() => ({
  db,
  secret: SECRET,
  baseUrl: BASE_URL,
}));

// Sunday 2026-12-20, 10:00 Cairo. Friday slots are 18:00-20:00 Cairo
// (16:00-18:00 UTC), five days away, so they are bookable and not urgent.
const NOW = new Date("2026-12-20T08:00:00Z");
const PHONE = "+201001234567";
let now = NOW;
const clock: Clock = { now: () => now };
const ctx = { ...createCallContext({ kind: "anonymous" }), clock };
const minutes = 60_000;

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
    occasionId: 1,
    name: "Mona Hassan",
    phone: PHONE,
    token: tokenFor(),
    locale: "ar",
    ...overrides,
  };
}

async function rows() {
  return db.select().from(booking).orderBy(booking.id);
}

describe("bookings.create", () => {
  it("creates a held booking with the quoted price and deposit and queues the link", async () => {
    const result = await ops.create(input(), ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const deadline = new Date(now.getTime() + 20 * minutes);
    expect(result.data).toMatchObject({
      deadlineAt: deadline.toISOString(),
      priceEgp: 1000,
      depositEgp: 500,
      urgent: false,
    });
    expect(result.data.bookingId).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(result.data.linkToken).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const [row] = await rows();
    expect(row).toMatchObject({
      publicId: result.data.bookingId,
      accessToken: result.data.linkToken,
      status: "held",
      source: "online",
      customerName: "Mona Hassan",
      customerPhone: PHONE,
      locale: "ar",
      priceEgp: 1000,
      depositEgp: 500,
      urgent: false,
    });
    expect(row?.startsAt).toEqual(new Date("2026-12-25T16:00:00Z"));
    expect(row?.endsAt).toEqual(new Date("2026-12-25T18:00:00Z"));
    expect(row?.holdExpiresAt).toEqual(deadline);

    const [message] = await db.select().from(outboxMessage);
    expect(message).toMatchObject({
      bookingId: row?.id,
      recipient: PHONE,
      channel: "whatsapp",
      template: "booking-link",
      locale: "ar",
      expiresAt: deadline,
    });
    expect(message?.values).toMatchObject({
      deadlineAt: deadline.toISOString(),
      link: `${BASE_URL}/booking/${result.data.linkToken}`,
    });
  });

  it("normalizes an Egyptian local number before storing it", async () => {
    const phone = "01001234567";
    const result = await ops.create(
      input({ phone, token: tokenFor("+201001234567") }),
      ctx,
    );
    expect(result.ok).toBe(true);
    const [row] = await rows();
    expect(row?.customerPhone).toBe("+201001234567");
  });

  it("refuses a missing, expired or mismatched verified-phone token", async () => {
    const missing = await ops.create(input({ token: "" }), ctx);
    expect(missing.ok ? undefined : missing.error.code).toBe(
      "VALIDATION_FAILED",
    );

    const expired = await ops.create(
      input({
        token: tokenFor(
          PHONE,
          new Date(
            now.getTime() - (VERIFIED_PHONE_TOKEN_MINUTES + 1) * minutes,
          ),
        ),
      }),
      ctx,
    );
    expect(expired.ok ? undefined : expired.error.code).toBe(
      "PHONE_NOT_VERIFIED",
    );

    const other = await ops.create(
      input({ token: tokenFor("+201009999999") }),
      ctx,
    );
    expect(other.ok ? undefined : other.error.code).toBe("PHONE_NOT_VERIFIED");

    expect(await rows()).toHaveLength(0);
  });

  it("refuses a closed date, an unknown slot and a started slot", async () => {
    await db.insert(dateException).values({ day: "2026-12-25", closed: true });
    const closed = await ops.create(input(), ctx);
    expect(closed.ok ? undefined : closed.error.code).toBe("SLOT_UNAVAILABLE");
    expect(closed.ok ? undefined : closed.error.details?.reason).toBe("closed");

    await db.delete(dateException);
    const missing = await ops.create(input({ start: "19:00" }), ctx);
    expect(missing.ok ? undefined : missing.error.details?.reason).toBe(
      "missing",
    );

    now = new Date("2026-12-25T16:30:00Z"); // 18:30 Cairo, after the start
    const past = await ops.create(input({ token: tokenFor() }), ctx);
    expect(past.ok ? undefined : past.error.details?.reason).toBe("past");
  });

  it("refuses a slot inside the near-slot cutoff", async () => {
    now = new Date("2026-12-25T15:00:00Z"); // one hour before the start
    const result = await ops.create(input({ token: tokenFor() }), ctx);
    expect(result.ok ? undefined : result.error.code).toBe("SLOT_UNAVAILABLE");
    expect(result.ok ? undefined : result.error.details?.reason).toBe(
      "near_slot",
    );
  });

  it("refuses an unknown or inactive occasion", async () => {
    const unknown = await ops.create(input({ occasionId: 99 }), ctx);
    expect(unknown.ok ? undefined : unknown.error.code).toBe(
      "OCCASION_UNAVAILABLE",
    );

    await db.update(occasion).set({ active: false });
    const inactive = await ops.create(input(), ctx);
    expect(inactive.ok ? undefined : inactive.error.code).toBe(
      "OCCASION_UNAVAILABLE",
    );
  });

  it("caps the deadline at the near-slot cutoff and flags an urgent hold", async () => {
    // 00:00 UTC on the booked Friday is 02:00 Cairo: 16 hours before the slot,
    // inside the 24-hour urgent threshold and outside the 2-hour cutoff.
    now = new Date("2026-12-25T00:00:00Z");
    const result = await ops.create(input({ token: tokenFor() }), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.urgent).toBe(true);
    expect(result.data.deadlineAt).toBe(
      new Date("2026-12-25T00:20:00Z").toISOString(),
    );
  });

  it("queues an urgent staff alert when the hold is on a soon slot", async () => {
    await db.insert(staffUser).values(
      aStaffUser({
        id: "staff-en",
        name: "Mona",
        notifyPhone: "+201002222222",
        locale: "en",
      }),
    );
    now = new Date("2026-12-25T00:00:00Z");
    const result = await ops.create(input({ token: tokenFor() }), ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const messages = await db
      .select()
      .from(outboxMessage)
      .orderBy(outboxMessage.id);
    expect(messages.map((message) => message.template)).toEqual([
      "booking-link",
      "staff-alert",
    ]);
    const alert = messages.find(
      (message) => message.template === "staff-alert",
    );
    expect(alert).toMatchObject({
      recipient: "+201002222222",
      locale: "en",
      channel: "whatsapp",
      expiresAt: new Date("2026-12-25T16:00:00Z"),
    });
    expect(alert?.values).toMatchObject({
      kind: "urgent",
      link: `${BASE_URL}/en/dashboard/review/${result.data.bookingId}`,
      customerName: "Mona Hassan",
      slotStartAt: "2026-12-25T16:00:00.000Z",
    });
    expect(typeof alert?.values.occasion).toBe("string");
  });

  it("does not alert staff for a hold outside the urgent threshold", async () => {
    await db
      .insert(staffUser)
      .values(aStaffUser({ id: "staff-ar", notifyPhone: "+201001111111" }));
    const result = await ops.create(input(), ctx);
    expect(result.ok).toBe(true);

    const messages = await db.select().from(outboxMessage);
    expect(messages.map((message) => message.template)).toEqual([
      "booking-link",
    ]);
  });

  it("lets exactly one of two customers hold the slot", async () => {
    const first = ops.create(
      input({ phone: "+201001111111", token: tokenFor("+201001111111") }),
      ctx,
    );
    const second = ops.create(
      input({ phone: "+201002222222", token: tokenFor("+201002222222") }),
      ctx,
    );
    const results = await Promise.all([first, second]);

    const codes = results.map((result) =>
      result.ok ? "OK" : result.error.code,
    );
    expect(codes.sort()).toEqual(["OK", "SLOT_TAKEN"]);
    expect(await rows()).toHaveLength(1);
    expect(await db.select().from(outboxMessage)).toHaveLength(1);
  });

  it("refuses a second hold from the same phone until the first ends", async () => {
    const results = await Promise.all([
      ops.create(input(), ctx),
      ops.create(input(), ctx),
    ]);
    const codes = results.map((result) =>
      result.ok ? "OK" : result.error.code,
    );
    expect(codes.sort()).toEqual(["OK", "PHONE_HOLD_EXISTS"]);
    expect(await rows()).toHaveLength(1);
  });

  it("reports the phone's existing held booking in the conflict details", async () => {
    await db.insert(booking).values(
      aBooking({
        publicId: "EXIST1",
        customerPhone: PHONE,
        startsAt: new Date("2027-01-01T16:00:00Z"),
        endsAt: new Date("2027-01-01T18:00:00Z"),
        holdExpiresAt: new Date("2027-01-01T16:20:00Z"),
      }),
    );

    const result = await ops.create(input(), ctx);
    expect(result.ok ? undefined : result.error.code).toBe("PHONE_HOLD_EXISTS");
    expect(result.ok ? undefined : result.error.details?.bookingId).toBe(
      "EXIST1",
    );
  });

  it("treats an overdue hold as expired before creating the new one", async () => {
    await db.insert(booking).values(
      aBooking({
        customerPhone: "+201009999999",
        startsAt: new Date("2026-12-25T16:00:00Z"),
        endsAt: new Date("2026-12-25T18:00:00Z"),
        holdExpiresAt: new Date("2026-12-20T07:59:00Z"),
      }),
    );

    const result = await ops.create(input(), ctx);
    expect(result.ok).toBe(true);
    const stored = await rows();
    expect(stored).toHaveLength(2);
    expect(stored[0]?.status).toBe("expired");
    expect(stored[1]?.status).toBe("held");
  });

  it("does not free a hold that has not reached its deadline", async () => {
    await db.insert(booking).values(
      aBooking({
        customerPhone: "+201009999999",
        startsAt: new Date("2026-12-25T16:00:00Z"),
        endsAt: new Date("2026-12-25T18:00:00Z"),
        holdExpiresAt: new Date("2026-12-20T08:20:00Z"),
      }),
    );

    const result = await ops.create(input(), ctx);
    expect(result.ok ? undefined : result.error.code).toBe("SLOT_TAKEN");
  });

  it("enforces the no-overlap rule in the database itself", async () => {
    await db.insert(booking).values(
      aBooking({
        status: "confirmed",
        startsAt: new Date("2026-12-25T16:00:00Z"),
        endsAt: new Date("2026-12-25T18:00:00Z"),
        holdExpiresAt: null,
      }),
    );

    await expect(
      db.insert(booking).values(
        aBooking({
          publicId: "OVERLAP",
          accessToken: "overlap-token",
          customerPhone: "+201008888888",
          status: "held",
          startsAt: new Date("2026-12-25T17:00:00Z"),
          endsAt: new Date("2026-12-25T19:00:00Z"),
        }),
      ),
    ).rejects.toThrow();
    expect(await rows()).toHaveLength(1);
  });
});
