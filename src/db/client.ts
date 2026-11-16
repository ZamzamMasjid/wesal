import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type DbHandle = ReturnType<typeof createDb>;
export type Database = DbHandle["db"];

/** Opens a pool and a typed Drizzle client. Callers own `pool.end()`. */
export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export function requireDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and run `npm run db:up`.",
    );
  }
  return url;
}

let shared: DbHandle | undefined;

/** The app-wide client, created on first use from DATABASE_URL. */
export function getDb(): Database {
  shared ??= createDb(requireDatabaseUrl());
  return shared.db;
}
