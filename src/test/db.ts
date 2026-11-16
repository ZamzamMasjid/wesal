import { sql } from "drizzle-orm";

import { createDb, type DbHandle } from "@/db/client";

export const DEFAULT_TEST_DATABASE_URL =
  "postgres://wesal:wesal@localhost:5432/wesal_test";

export function testDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
}

/** Opens a client on the test database. Callers `await handle.pool.end()`. */
export function openTestDb(): DbHandle {
  return createDb(testDatabaseUrl());
}

/**
 * Empties every table in the public schema (except Drizzle's migration log)
 * and resets identities. Call it in `beforeEach` for per-test isolation. Tests
 * that must commit for real (race tests) use this too, so they clean up.
 */
export async function resetDatabase(handle: DbHandle): Promise<void> {
  await handle.db.execute(sql`
    DO $$
    DECLARE tables text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
        INTO tables
        FROM pg_tables
       WHERE schemaname = 'public';
      IF tables IS NOT NULL THEN
        EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
      END IF;
    END $$;
  `);
}

/**
 * Runs `fn` in a transaction that is always rolled back: isolation for tests
 * that do not themselves need to commit.
 */
export async function withRollback<T>(
  handle: DbHandle,
  fn: (
    tx: Parameters<Parameters<DbHandle["db"]["transaction"]>[0]>[0],
  ) => Promise<T>,
): Promise<T> {
  const rollback = Symbol("rollback");
  let result: T | undefined;
  try {
    await handle.db.transaction(async (tx) => {
      result = await fn(tx);
      throw rollback;
    });
  } catch (err) {
    if (err !== rollback) throw err;
  }
  return result as T;
}
