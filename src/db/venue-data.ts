import type { Database } from "./client";
import { occasion, slotPattern } from "./schema";

// The venue's opening data: the sample occasions and the weekly slot pattern.
// Kept apart from the owner account so a one-off production sync can reuse it
// without ever creating a known-password login (docs/DEPLOYMENT.md).

export const OCCASIONS = [
  { nameAr: "حفل زفاف", nameEn: "Wedding", priceEgp: 15000 },
  { nameAr: "حفل خطوبة", nameEn: "Engagement party", priceEgp: 8000 },
  { nameAr: "كتب كتاب", nameEn: "Nikah", priceEgp: 5000 },
  { nameAr: "عزاء", nameEn: "Funeral", priceEgp: 3000 },
];

// Weekday 0 = Sunday. Friday (5) differs: nothing before midday prayer.
export const WEEKDAY_SLOTS = [
  { start: "10:00", end: "14:00" },
  { start: "16:00", end: "20:00" },
  { start: "20:00", end: "23:59" },
];

export const FRIDAY_SLOTS = [
  { start: "14:00", end: "18:00" },
  { start: "18:00", end: "22:00" },
];

/**
 * Inserts the sample occasions and the weekly pattern into empty tables and
 * leaves populated ones untouched, so running it twice is safe. `replace`
 * clears both tables first; it is for a deliberate production reset and a
 * booking that still references an occasion will abort the transaction.
 */
export async function seedVenueData(
  db: Database,
  { replace = false }: { replace?: boolean } = {},
): Promise<void> {
  await db.transaction(async (tx) => {
    if (replace) {
      await tx.delete(slotPattern);
      await tx.delete(occasion);
    }

    if ((await tx.select({ id: occasion.id }).from(occasion)).length === 0) {
      await tx
        .insert(occasion)
        .values(OCCASIONS.map((o, position) => ({ ...o, position })));
    }

    if (
      (await tx.select({ id: slotPattern.id }).from(slotPattern)).length === 0
    ) {
      const rows = [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) =>
        (weekday === 5 ? FRIDAY_SLOTS : WEEKDAY_SLOTS).map((s) => ({
          weekday,
          startTime: s.start,
          endTime: s.end,
        })),
      );
      await tx.insert(slotPattern).values(rows);
    }
  });
}
