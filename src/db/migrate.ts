// Applies pending migrations from ./drizzle. Run locally with `npm run db:migrate`
// and, in production, as the Fly release command (ADR-021).
import path from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDb, requireDatabaseUrl } from "./client";

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export async function runMigrations(connectionString: string): Promise<void> {
  const { db, pool } = createDb(connectionString);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && /migrate\.[cm]?[tj]s$/.test(process.argv[1])) {
  runMigrations(requireDatabaseUrl()).then(
    () => process.stdout.write("migrations applied\n"),
    (err: unknown) => {
      process.stderr.write(`migration failed: ${String(err)}\n`);
      process.exit(1);
    },
  );
}
