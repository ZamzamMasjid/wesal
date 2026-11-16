// Runs once before the integration project: applies migrations to the test
// database so every file starts from the real schema.
import { runMigrations } from "@/db/migrate";

import { testDatabaseUrl } from "./db";

export default async function setup(): Promise<void> {
  await runMigrations(testDatabaseUrl());
}
