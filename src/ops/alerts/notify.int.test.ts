// SPEC: slot-alerts/spec.md — when a booking expires or is rejected, every subscriber gets one message with a link to the booking form, and nothing is reserved
// ROADMAP: phase-6-alerts-and-reports / slot-alerts / Notify subscribers through the outbox when the slot becomes free
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import { booking, occasion, outboxMessage, slotAlert, staffUser } from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { expireOverdueHolds } from "@/ops/booking/sweep";
import { createReviewOperations } from "@/ops/booking/review";
import { aBooking, anOccasion, aStaffUser } from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

const handle = openTestDb();
const { db } = handle;
const BASE_URL = "https://wesal.example";
const ops = createReviewOperations(() => ({ db, baseUrl: BASE_URL }));

const NOW = new Date("2026-12-20T08:00:00Z");
let now = NOW;
const clock: Clock = { now: () => now };
const staffCtx = {
  ...createCallContext({ kind: "staff", userId: "staff-1", role: "staff" }),
  clock,
};

const STARTS_AT = new Date("2026-12-25T16:00:00Z");
const ENDS_AT = new Date("2026-12-25T18:00:00Z");

beforeEach(async () => {
  now = NOW;
  await resetDatabase(handle);
  await db.insert(occasion).values(anOccasion({ priceEgp: 1000 }));
  await db.insert(staffUser).values(aStaffUser({ id: "staff-1" }));
});
afterAll(() => handle.pool.end());

async function subscribers(phones = ["+201001234567", "+201007654321"]) {
  await db.insert(slotAlert).values(
    phones.map((phone, index) => ({
      startsAt: STARTS_AT,
      endsAt: ENDS_AT,
      phone,
      locale: (index === 0 ? "ar" : "en") as "ar" | "en",
      token: `token-${index}`,
    })),
  );
}

describe("slot alerts when a slot frees", () => {
  it("queues one message per subscriber when an overdue hold expires", async () => {
    await db.insert(booking).values(
      aBooking({
        publicId: "HELD1",
        accessToken: "access-1",
        customerPhone: "+209990001111",
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
        status: "held",
        holdExpiresAt: new Date("2026-12-20T07:00:00Z"),
      }),
    );
    await subscribers();

    const summary = await expireOverdueHolds({ db, clock, baseUrl: BASE_URL });

    expect(summary).toEqual({ expired: 1, notified: 2 });
    const messages = await db
      .select()
      .from(outboxMessage)
      .orderBy(outboxMessage.id);
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.recipient)).toEqual([
      "+201001234567",
      "+201007654321",
    ]);
    for (const message of messages) {
      expect(message.template).toBe("slot-alert");
      expect(message.channel).toBe("whatsapp");
      expect(message.expiresAt).toEqual(STARTS_AT);
      expect(message.values.link).toContain(
        `${BASE_URL}${message.locale === "ar" ? "" : "/en"}/book?`,
      );
      expect(message.values.link).toContain("day=2026-12-25");
      expect(message.values.unsubscribe).toContain(
        `${BASE_URL}${message.locale === "ar" ? "" : "/en"}/alerts/unsubscribe/`,
      );
      expect(message.values.slotStartAt).toBe(STARTS_AT.toISOString());
    }
    // The English subscriber gets the English page and message.
    expect(messages[1]?.locale).toBe("en");
    expect(messages[1]?.values.link).toContain(`${BASE_URL}/en/book?`);

    const alerts = await db.select().from(slotAlert);
    expect(alerts.every((row) => row.notifiedAt?.getTime() === NOW.getTime())).toBe(
      true,
    );
  });

  it("does not tell the same subscriber twice when the sweep runs again", async () => {
    await db.insert(booking).values(
      aBooking({
        publicId: "HELD2",
        accessToken: "access-2",
        customerPhone: "+209990001112",
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
        status: "held",
        holdExpiresAt: new Date("2026-12-20T07:00:00Z"),
      }),
    );
    await subscribers(["+201001234567"]);

    await expireOverdueHolds({ db, clock, baseUrl: BASE_URL });
    const second = await expireOverdueHolds({ db, clock, baseUrl: BASE_URL });

    expect(second).toEqual({ expired: 0, notified: 0 });
    expect(await db.select().from(outboxMessage)).toHaveLength(1);
  });

  it("tells subscribers when staff reject a proof", async () => {
    await db.insert(booking).values(
      aBooking({
        publicId: "REJ01",
        accessToken: "access-3",
        customerPhone: "+209990001113",
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
        status: "proof_submitted",
        holdExpiresAt: null,
      }),
    );
    await subscribers(["+201001234567"]);

    const result = await ops.reject(
      { bookingId: "REJ01", reason: "wrong_amount", note: null },
      staffCtx,
    );

    expect(result.ok).toBe(true);
    const messages = await db.select().from(outboxMessage);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      template: "slot-alert",
      recipient: "+201001234567",
    });
  });

  it("ends the watch when the booking is confirmed", async () => {
    await db.insert(booking).values(
      aBooking({
        publicId: "CONF1",
        accessToken: "access-4",
        customerPhone: "+209990001114",
        startsAt: STARTS_AT,
        endsAt: ENDS_AT,
        status: "proof_submitted",
        holdExpiresAt: null,
      }),
    );
    await subscribers(["+201001234567"]);

    const result = await ops.confirm({ bookingId: "CONF1" }, staffCtx);

    expect(result.ok).toBe(true);
    expect(await db.select().from(slotAlert)).toHaveLength(0);
    expect(await db.select().from(outboxMessage)).toHaveLength(0);
  });
});
