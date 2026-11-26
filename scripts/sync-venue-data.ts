// One-off production sync of the venue's opening data (docs/DEPLOYMENT.md).
// Inserts the sample occasions and the weekly slot pattern only into empty
// tables, so it never overwrites what the owner has changed. It deliberately
// does not create a staff account; use `dist/create-owner.mjs` for that.
import { createDb, requireDatabaseUrl } from "../src/db/client";
import { seedVenueData } from "../src/db/venue-data";

async function main(): Promise<void> {
  const { db, pool } = createDb(requireDatabaseUrl());
  const replace = process.argv.includes("--replace");
  try {
    await seedVenueData(db, { replace });
    process.stdout.write(
      replace
        ? "Occasions and the weekly slot pattern were replaced.\n"
        : "Occasions and the weekly slot pattern are in place.\n",
    );
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && /sync-venue-data\.[cm]?[tj]s$/.test(process.argv[1])) {
  main().catch((error: unknown) => {
    process.stderr.write(`Venue data sync failed: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
