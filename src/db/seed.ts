// Dev seed: an owner account, sample occasions and a weekly slot pattern.
// Idempotent: safe to run repeatedly. Never run against production.
import { eq } from "drizzle-orm";

import { createStaffAccount } from "@/auth/accounts";
import { createAuth } from "@/auth/auth";

import { createDb, requireDatabaseUrl, type Database } from "./client";
import { staffUser } from "./schema";
import { seedVenueData } from "./venue-data";

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

  await seedVenueData(db);
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
