// Postgres error codes the service layer reacts to. Drizzle wraps driver
// errors, so the code never sits on the thrown object itself; these helpers find
// it in the cause chain instead of every caller walking it by hand.

export interface PostgresError {
  code?: string;
  constraint?: string;
}

/** The first Postgres error in the cause chain, or null. */
export function postgresError(error: unknown): PostgresError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current !== "object" || current === null) return null;
    const candidate = current as Record<string, unknown>;
    if (typeof candidate.code === "string") return candidate as PostgresError;
    current = candidate.cause;
  }
  return null;
}

/** `23P01`: an exclusion constraint refused the row (the booking overlap rule). */
export function isExclusionViolation(error: unknown): boolean {
  return postgresError(error)?.code === "23P01";
}

/** `23505`: a unique constraint fired; `constraints` names the ones worth retrying. */
export function isUniqueViolation(
  error: unknown,
  constraints: string[],
): boolean {
  const pg = postgresError(error);
  return (
    pg?.code === "23505" &&
    pg.constraint !== undefined &&
    constraints.includes(pg.constraint)
  );
}
