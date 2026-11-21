// SPEC: docs/features/booking-management — staff list every booking with filters, enter phone/walk-in bookings, cancel and mark the remainder paid, each with an audit row
// ROADMAP: phase-4-operations / booking-management / Implement bookings list API with filters by date, status and source
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCallContext } from "@/api/context";
import {
  auditLog,
  booking,
  dateException,
  occasion,
  outboxMessage,
  paymentProof,
  slotPattern,
  staffUser,
} from "@/db/schema";
import type { Clock } from "@/lib/clock";
import { openTestDb, resetDatabase } from "@/test/db";
import {
  aBooking,
  anOccasion,
  aSlotPattern,
  aStaffUser,
} from "@/test/factories";

import { createAdminBookingOperations } from "./admin";

const handle = openTestDb();
const { db } = handle;

const BASE_URL = "https://wesal.example";
const ops = createAdminBookingOperations(() => ({ db, baseUrl: BASE_URL }));

// Sunday 2026-12-20, 10:00 Cairo. Sunday slots are 08:00-10:00 Cairo and
// Friday slots 18:00-20:00 Cairo (16:00-18:00 UTC).
const NOW = new Date("2026-12-20T08:00:00Z");
let now = NOW;
const clock: Clock = { now: () => now };
const staff = {
  ...createCallContext(
    { kind: "staff", userId: "staff-1", role: "staff" },
    { requestId: "admin-test" },
  ),
  clock,
};
const anonymous = { ...createCallContext({ kind: "anonymous" }), clock };

afterAll(async () => {
  await handle.pool.end();
});

beforeEach(async () => {
  now = NOW;
  slotSequence = 0;
  publicSequence = 0;
  await resetDatabase(handle);
  await db
    .insert(slotPattern)
    .values([
      aSlotPattern({ weekday: 0, startTime: "08:00", endTime: "10:00" }),
      aSlotPattern({ weekday: 5, startTime: "18:00", endTime: "20:00" }),
    ]);
  await db.insert(occasion).values(anOccasion({ priceEgp: 1000 }));
  await db
    .insert(staffUser)
    .values(aStaffUser({ id: "staff-1", name: "Ahmed" }));
});

let slotSequence = 0;
let publicSequence = 0;

async function aStoredBooking(
  overrides: Parameters<typeof aBooking>[0] = {},
): Promise<number> {
  const n = ++publicSequence;
  const offset = slotSequence++ * 3;
  const [row] = await db
    .insert(booking)
    .values(
      aBooking({
        publicId: `B${n}`,
        accessToken: `token-${n}`,
        occasionId: 1,
        priceEgp: 1000,
        depositEgp: 500,
        startsAt: new Date(Date.UTC(2026, 11, 25 + offset, 16, 0, 0)),
        endsAt: new Date(Date.UTC(2026, 11, 25 + offset, 18, 0, 0)),
        holdExpiresAt: null,
        ...overrides,
      }),
    )
    .returning({ id: booking.id });
  return row!.id;
}

function manualInput(overrides: Record<string, unknown> = {}) {
  return {
    day: "2026-12-25",
    start: "18:00",
    end: "20:00",
    occasionId: 1,
    name: "Mona Hassan",
    phone: "01001234567",
    ...overrides,
  };
}

async function auditRows(bookingId: number) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.bookingId, bookingId))
    .orderBy(asc(auditLog.id));
}

describe("staff.bookings.list", () => {
  it("lists upcoming bookings soonest first and leaves past ones out", async () => {
    await aStoredBooking({
      publicId: "PAST01",
      status: "confirmed",
      startsAt: new Date("2026-12-01T16:00:00Z"),
      endsAt: new Date("2026-12-01T18:00:00Z"),
    });
    await aStoredBooking({
      publicId: "SOON01",
      status: "confirmed",
      startsAt: new Date("2026-12-24T16:00:00Z"),
      endsAt: new Date("2026-12-24T18:00:00Z"),
    });
    await aStoredBooking({
      publicId: "LATER1",
      status: "confirmed",
      startsAt: new Date("2026-12-26T16:00:00Z"),
      endsAt: new Date("2026-12-26T18:00:00Z"),
    });

    const result = await ops.list({}, staff);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.total).toBe(2);
    expect(result.data.items.map((item) => item.bookingId)).toEqual([
      "SOON01",
      "LATER1",
    ]);
    expect(result.data.items[0]).toMatchObject({
      status: "confirmed",
      source: "online",
      occasion: { nameAr: "مناسبة 1", nameEn: "Occasion 1" },
      customerPhone: "+201001234567",
      day: "2026-12-24",
      start: "18:00",
      end: "20:00",
      priceEgp: 1000,
      depositEgp: 500,
      remainderEgp: 500,
      remainderPaid: false,
    });
  });

  it("filters by status, treating an overdue hold as expired (ADR-010)", async () => {
    await aStoredBooking({ publicId: "CONF01", status: "confirmed" });
    await aStoredBooking({
      publicId: "HOLD01",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() + 10 * 60_000),
    });
    await aStoredBooking({
      publicId: "OLDHLD",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() - 60_000),
    });

    const held = await ops.list({ status: "held" }, staff);
    expect(held.ok && held.data.items.map((item) => item.bookingId)).toEqual([
      "HOLD01",
    ]);

    const expired = await ops.list({ status: "expired" }, staff);
    expect(expired.ok).toBe(true);
    if (!expired.ok) return;
    expect(expired.data.items.map((item) => item.bookingId)).toEqual([
      "OLDHLD",
    ]);
    expect(expired.data.items[0]?.status).toBe("expired");

    const confirmed = await ops.list({ status: "confirmed" }, staff);
    expect(
      confirmed.ok && confirmed.data.items.map((item) => item.bookingId),
    ).toEqual(["CONF01"]);
  });

  it("filters by source and searches name, phone or booking id", async () => {
    await aStoredBooking({
      publicId: "ABC234",
      status: "confirmed",
      customerName: "Mona Hassan",
      customerPhone: "+201001234567",
    });
    await aStoredBooking({
      publicId: "STF001",
      status: "confirmed",
      source: "staff",
      customerName: "Sara Ali",
      customerPhone: "+201009876543",
    });

    const staffOnly = await ops.list({ source: "staff" }, staff);
    expect(
      staffOnly.ok && staffOnly.data.items.map((item) => item.bookingId),
    ).toEqual(["STF001"]);

    const byName = await ops.list({ q: "mona" }, staff);
    expect(
      byName.ok && byName.data.items.map((item) => item.bookingId),
    ).toEqual(["ABC234"]);

    // The caller's local form is normalised before it is compared.
    const byPhone = await ops.list({ q: "01001234567" }, staff);
    expect(
      byPhone.ok && byPhone.data.items.map((item) => item.bookingId),
    ).toEqual(["ABC234"]);

    const byId = await ops.list({ q: "abc234" }, staff);
    expect(byId.ok && byId.data.items.map((item) => item.bookingId)).toEqual([
      "ABC234",
    ]);
  });

  it("reads a past date range newest first and a future one soonest first", async () => {
    await aStoredBooking({
      publicId: "DEC01X",
      status: "confirmed",
      startsAt: new Date("2026-12-01T16:00:00Z"),
      endsAt: new Date("2026-12-01T18:00:00Z"),
    });
    await aStoredBooking({
      publicId: "DEC05X",
      status: "confirmed",
      startsAt: new Date("2026-12-05T16:00:00Z"),
      endsAt: new Date("2026-12-05T18:00:00Z"),
    });
    await aStoredBooking({
      publicId: "DEC28X",
      status: "confirmed",
      startsAt: new Date("2026-12-28T16:00:00Z"),
      endsAt: new Date("2026-12-28T18:00:00Z"),
    });

    const past = await ops.list(
      { from: "2026-12-01", to: "2026-12-10" },
      staff,
    );
    expect(past.ok && past.data.items.map((item) => item.bookingId)).toEqual([
      "DEC05X",
      "DEC01X",
    ]);

    const future = await ops.list({ from: "2026-12-21" }, staff);
    expect(
      future.ok && future.data.items.map((item) => item.bookingId),
    ).toEqual(["DEC28X"]);
  });

  it("pages 25 at a time with a total", async () => {
    for (let index = 0; index < 26; index++) {
      await aStoredBooking({
        status: "confirmed",
        startsAt: new Date(Date.UTC(2027, 0, 1 + index, 16, 0, 0)),
        endsAt: new Date(Date.UTC(2027, 0, 1 + index, 18, 0, 0)),
      });
    }

    const first = await ops.list({}, staff);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.total).toBe(26);
    expect(first.data.pageSize).toBe(25);
    expect(first.data.items).toHaveLength(25);

    const second = await ops.list({ page: 2 }, staff);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.items).toHaveLength(1);
    expect(second.data.page).toBe(2);
  });

  it("refuses an anonymous caller", async () => {
    const result = await ops.list({}, anonymous);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("staff.bookings.detail", () => {
  it("returns proofs newest first and the merged customer and staff history", async () => {
    const id = await aStoredBooking({
      publicId: "HIST01",
      status: "confirmed",
      customerName: "Mona",
      createdAt: new Date(NOW.getTime() - 180 * 60_000),
    });
    await db.insert(paymentProof).values([
      {
        bookingId: id,
        filePath: "proofs/one.png",
        receivedVia: "upload",
        uploadedAt: new Date(NOW.getTime() - 120 * 60_000),
      },
      {
        bookingId: id,
        filePath: null,
        receivedVia: "whatsapp",
        uploadedAt: new Date(NOW.getTime() - 60 * 60_000),
      },
    ]);
    await db.insert(auditLog).values({
      actorId: "staff-1",
      action: "booking.confirm",
      target: "booking:HIST01",
      bookingId: id,
      detail: { from: "proof_submitted", to: "confirmed" },
      at: NOW,
    });

    const result = await ops.detail({ bookingId: "hist01" }, staff);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.bookingId).toBe("HIST01");
    expect(result.data.proofs.map((proof) => proof.receivedVia)).toEqual([
      "whatsapp",
      "upload",
    ]);
    expect(result.data.history.map((entry) => entry.action)).toEqual([
      "created",
      "proof_uploaded",
      "confirmed",
    ]);
    expect(result.data.history[0]).toMatchObject({ actor: "customer" });
    expect(result.data.history[2]).toMatchObject({
      actor: "staff",
      actorName: "Ahmed",
    });
  });

  it("shows staff entry notes and cancellation reasons", async () => {
    const created = await ops.create(
      manualInput({ note: "Deposit taken in cash" }),
      staff,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const cancelled = await ops.cancel(
      { bookingId: created.data.bookingId, reason: "Family changed the date" },
      staff,
    );
    expect(cancelled.ok).toBe(true);

    const result = await ops.detail(
      { bookingId: created.data.bookingId },
      staff,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("cancelled");
    expect(result.data.history).toEqual([
      expect.objectContaining({
        action: "created",
        actor: "staff",
        actorName: "Ahmed",
        note: "Deposit taken in cash",
      }),
      expect.objectContaining({
        action: "cancelled",
        actor: "staff",
        note: "Family changed the date",
      }),
    ]);
  });

  it("answers NOT_FOUND for an unknown booking", async () => {
    const result = await ops.detail({ bookingId: "NOPE00" }, staff);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("staff.bookings.create", () => {
  it("enters a confirmed staff booking with the current price, no deposit and a queued link", async () => {
    const result = await ops.create(
      manualInput({ note: "Called at noon" }),
      staff,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      bookingId: expect.stringMatching(/^[A-HJ-NP-Z2-9]{6}$/),
      day: "2026-12-25",
      start: "18:00",
      end: "20:00",
      priceEgp: 1000,
      depositEgp: 0,
    });

    const [row] = await db
      .select()
      .from(booking)
      .where(eq(booking.publicId, result.data.bookingId));
    expect(row).toMatchObject({
      status: "confirmed",
      source: "staff",
      customerName: "Mona Hassan",
      customerPhone: "+201001234567",
      locale: "ar",
      priceEgp: 1000,
      depositEgp: 0,
      holdExpiresAt: null,
      urgent: false,
    });
    expect(row?.startsAt).toEqual(new Date("2026-12-25T16:00:00Z"));
    expect(row?.endsAt).toEqual(new Date("2026-12-25T18:00:00Z"));

    const [message] = await db.select().from(outboxMessage);
    expect(message).toMatchObject({
      bookingId: row?.id,
      recipient: "+201001234567",
      channel: "whatsapp",
      template: "booking-confirmed",
      locale: "ar",
    });
    expect(message?.values.link).toContain(row!.accessToken);

    const audits = await auditRows(row!.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: "staff-1",
      action: "booking.enter",
      target: `booking:${row!.publicId}`,
      detail: expect.objectContaining({
        to: "confirmed",
        note: "Called at noon",
      }),
    });
  });

  it("refuses a slot an online hold owns and says who holds it until when", async () => {
    const deadline = new Date(NOW.getTime() + 12 * 60_000);
    await aStoredBooking({
      publicId: "HELD01",
      status: "held",
      customerName: "Hana",
      startsAt: new Date("2026-12-25T16:00:00Z"),
      endsAt: new Date("2026-12-25T18:00:00Z"),
      holdExpiresAt: deadline,
    });

    const result = await ops.create(manualInput(), staff);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("SLOT_TAKEN");
    expect(result.error.details).toEqual({
      holder: {
        bookingId: "HELD01",
        status: "held",
        customerName: "Hana",
        deadlineAt: deadline.toISOString(),
      },
    });
    expect(await db.select().from(booking)).toHaveLength(1);
  });

  it("expires an overdue hold on the range and then takes the slot (ADR-010)", async () => {
    const id = await aStoredBooking({
      publicId: "OLD001",
      status: "held",
      startsAt: new Date("2026-12-25T16:00:00Z"),
      endsAt: new Date("2026-12-25T18:00:00Z"),
      holdExpiresAt: new Date(NOW.getTime() - 60_000),
    });

    const result = await ops.create(manualInput(), staff);
    expect(result.ok).toBe(true);

    const [old] = await db.select().from(booking).where(eq(booking.id, id));
    expect(old?.status).toBe("expired");
  });

  it("refuses a closed date, a slot that is not offered, and one that has ended", async () => {
    await db.insert(dateException).values({ day: "2026-12-25", closed: true });

    const closed = await ops.create(manualInput(), staff);
    expect(closed.ok).toBe(false);
    if (!closed.ok) {
      expect(closed.error.code).toBe("SLOT_UNAVAILABLE");
      expect(closed.error.details).toEqual({ reason: "closed" });
    }

    await db
      .update(dateException)
      .set({ closed: false })
      .where(eq(dateException.day, "2026-12-25"));

    const missing = await ops.create(manualInput({ day: "2026-12-24" }), staff);
    expect(missing.ok).toBe(false);
    if (!missing.ok)
      expect(missing.error.details).toEqual({ reason: "missing" });

    // 10:00 Cairo is the moment the Sunday 08:00-10:00 slot ends.
    const ended = await ops.create(
      manualInput({ day: "2026-12-20", start: "08:00", end: "10:00" }),
      staff,
    );
    expect(ended.ok).toBe(false);
    if (!ended.ok) expect(ended.error.details).toEqual({ reason: "past" });
  });

  it("rejects an invalid phone and an occasion that is not offered", async () => {
    const badPhone = await ops.create(manualInput({ phone: "123" }), staff);
    expect(badPhone.ok).toBe(false);
    if (!badPhone.ok) expect(badPhone.error.code).toBe("VALIDATION_FAILED");

    await db.update(occasion).set({ active: false }).where(eq(occasion.id, 1));
    const inactive = await ops.create(manualInput(), staff);
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) expect(inactive.error.code).toBe("OCCASION_UNAVAILABLE");
  });

  it("needs no verified phone: staff vouch for the caller", async () => {
    // The input has no token at all; a customer hold would be refused.
    const result = await ops.create(manualInput(), staff);
    expect(result.ok).toBe(true);
  });
});

describe("staff.bookings.cancel", () => {
  it("cancels a confirmed booking with a reason, frees the slot and audits it", async () => {
    const id = await aStoredBooking({
      publicId: "CONF02",
      status: "confirmed",
      startsAt: new Date("2026-12-25T16:00:00Z"),
      endsAt: new Date("2026-12-25T18:00:00Z"),
    });

    const result = await ops.cancel(
      { bookingId: "conf02", reason: "Family changed the date" },
      staff,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      bookingId: "CONF02",
      status: "cancelled",
    });

    const [row] = await db.select().from(booking).where(eq(booking.id, id));
    expect(row?.status).toBe("cancelled");
    const audits = await auditRows(id);
    expect(audits[0]).toMatchObject({
      action: "booking.cancel",
      detail: {
        from: "confirmed",
        to: "cancelled",
        reason: "Family changed the date",
      },
    });

    // The slot is free at once: a manual entry for the same range succeeds.
    const replacement = await ops.create(
      manualInput({ name: "Sara Ali" }),
      staff,
    );
    expect(replacement.ok).toBe(true);
  });

  it("refuses a held booking and stamps an overdue hold expired", async () => {
    const future = await aStoredBooking({
      publicId: "HELD02",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() + 10 * 60_000),
    });
    const held = await ops.cancel({ bookingId: "HELD02", reason: "x" }, staff);
    expect(held.ok).toBe(false);
    if (!held.ok) {
      expect(held.error.code).toBe("BOOKING_STATUS_CHANGED");
      expect(held.error.details).toEqual({ status: "held" });
    }

    const overdue = await aStoredBooking({
      publicId: "OLD002",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() - 60_000),
    });
    const expired = await ops.cancel(
      { bookingId: "OLD002", reason: "x" },
      staff,
    );
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.error.code).toBe("BOOKING_STATUS_CHANGED");
      expect(expired.error.details).toEqual({ status: "expired" });
    }
    const [stamped] = await db
      .select()
      .from(booking)
      .where(eq(booking.id, overdue));
    expect(stamped?.status).toBe("expired");

    const [untouched] = await db
      .select()
      .from(booking)
      .where(eq(booking.id, future));
    expect(untouched?.status).toBe("held");
  });

  it("requires a reason", async () => {
    await aStoredBooking({ publicId: "CONF03", status: "confirmed" });
    const result = await ops.cancel(
      { bookingId: "CONF03", reason: "   " },
      staff,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_FAILED");
  });

  it("answers NOT_FOUND for an unknown booking", async () => {
    const result = await ops.cancel(
      { bookingId: "NOPE00", reason: "x" },
      staff,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });
});

describe("staff.bookings.remainderPaid", () => {
  it("marks the remainder paid on a confirmed booking with an audit row", async () => {
    const id = await aStoredBooking({
      publicId: "CONF04",
      status: "confirmed",
    });

    const result = await ops.remainderPaid({ bookingId: "conf04" }, staff);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      bookingId: "CONF04",
      status: "confirmed",
      remainderPaid: true,
    });

    const [row] = await db.select().from(booking).where(eq(booking.id, id));
    expect(row?.remainderPaid).toBe(true);
    const audits = await auditRows(id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "booking.remainder_paid",
      detail: { amountEgp: 500 },
    });
  });

  it("is idempotent: marking it again writes no second audit row", async () => {
    await aStoredBooking({ publicId: "CONF05", status: "confirmed" });
    await ops.remainderPaid({ bookingId: "CONF05" }, staff);
    const again = await ops.remainderPaid({ bookingId: "CONF05" }, staff);
    expect(again.ok).toBe(true);
    const [row] = await db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.publicId, "CONF05"));
    expect(
      await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.bookingId, row!.id),
            eq(auditLog.action, "booking.remainder_paid"),
          ),
        ),
    ).toHaveLength(1);
  });

  it("refuses a booking that is not confirmed", async () => {
    await aStoredBooking({
      publicId: "HELD03",
      status: "held",
      holdExpiresAt: new Date(NOW.getTime() + 10 * 60_000),
    });
    const result = await ops.remainderPaid({ bookingId: "HELD03" }, staff);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BOOKING_STATUS_CHANGED");
      expect(result.error.details).toEqual({ status: "held" });
    }
  });
});
