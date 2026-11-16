// Dev seed: an owner account, sample occasions and a weekly slot pattern.
// Idempotent: safe to run repeatedly. Never run against production.
import { eq } from "drizzle-orm";

import { createStaffAccount } from "@/auth/accounts";
import { createAuth } from "@/auth/auth";

import { createDb, requireDatabaseUrl, type Database } from "./client";
import { occasion, slotPattern, staffUser } from "./schema";

const OCCASIONS = [
  { nameAr: "حفل زفاف", nameEn: "Wedding", priceEgp: 15000 },
  { nameAr: "حفل خطوبة", nameEn: "Engagement party", priceEgp: 8000 },
  { nameAr: "كتب كتاب", nameEn: "Nikah", priceEgp: 5000 },
  { nameAr: "عزاء", nameEn: "Funeral", priceEgp: 3000 },
];

// Weekday 0 = Sunday. Friday (5) differs: nothing before midday prayer.
const WEEKDAY_SLOTS = [
  { start: "10:00", end: "14:00" },
  { start: "16:00", end: "20:00" },
  { start: "20:00", end: "23:59" },
];
const FRIDAY_SLOTS = [
  { start: "14:00", end: "18:00" },
  { start: "18:00", end: "22:00" },
];

/** The development owner login. Override the password with SEED_OWNER_PASSWORD. */
export const SEED_OWNER_USERNAME = "owner";
export const SEED_OWNER_DEFAULT_PASSWORD = "owner-password";

export async function seed(db: Database): Promise<void> {
  const owner = await db
    .select({ id: staffUser.id })
    .from(staffUser)
    .where(eq(staffUser.username, SEED_OWNER_USERNAME));
  if (owner.length === 0) {
    // Only the password hash is used from this instance, so the secret and URL
    // here never leave the seed script.
    const auth = createAuth(db, {
      secret: "seed-script-only-secret-not-used-for-sessions",
      baseURL: "http://localhost:3000",
    });
    await createStaffAccount(auth, {
      name: "Owner",
      username: SEED_OWNER_USERNAME,
      password: process.env.SEED_OWNER_PASSWORD ?? SEED_OWNER_DEFAULT_PASSWORD,
      role: "owner",
    });
  }

  await db.transaction(async (tx) => {
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

if (process.argv[1] && /seed\.[cm]?[tj]s$/.test(process.argv[1])) {
  const { db, pool } = createDb(requireDatabaseUrl());
  seed(db)
    .then(() => process.stdout.write("seed complete\n"))
    .catch((err: unknown) => {
      process.stderr.write(`seed failed: ${String(err)}\n`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
