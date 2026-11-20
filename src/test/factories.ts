// Hand-written builders with overridable fields. Each returns a plain insert
// row; pass it to `db.insert(table).values(...)`. Later sections add
// aBooking() and friends beside these.
import type { InferInsertModel } from "drizzle-orm";

import type { booking, occasion, slotPattern, staffUser } from "@/db/schema";

let counter = 0;
const next = () => ++counter;

export function aStaffUser(
  overrides: Partial<InferInsertModel<typeof staffUser>> = {},
): InferInsertModel<typeof staffUser> {
  const n = next();
  return {
    id: `staff-${n}`,
    name: `Staff ${n}`,
    username: `staff${n}`,
    email: `staff${n}@staff.wesal.invalid`,
    role: "staff",
    ...overrides,
  };
}

export function anOccasion(
  overrides: Partial<InferInsertModel<typeof occasion>> = {},
): InferInsertModel<typeof occasion> {
  const n = next();
  return {
    nameAr: `مناسبة ${n}`,
    nameEn: `Occasion ${n}`,
    priceEgp: 1000,
    ...overrides,
  };
}

export function aSlotPattern(
  overrides: Partial<InferInsertModel<typeof slotPattern>> = {},
): InferInsertModel<typeof slotPattern> {
  return { weekday: 5, startTime: "18:00", endTime: "22:00", ...overrides };
}

export function aBooking(
  overrides: Partial<InferInsertModel<typeof booking>> = {},
): InferInsertModel<typeof booking> {
  const n = next();
  return {
    publicId: `B${n}`,
    accessToken: `token-${n}`,
    occasionId: 1,
    startsAt: new Date("2026-12-25T16:00:00Z"),
    endsAt: new Date("2026-12-25T18:00:00Z"),
    status: "held",
    source: "online",
    customerName: `Customer ${n}`,
    customerPhone: "+201001234567",
    locale: "ar",
    priceEgp: 1000,
    depositEgp: 500,
    holdExpiresAt: new Date("2026-12-25T16:20:00Z"),
    ...overrides,
  };
}
