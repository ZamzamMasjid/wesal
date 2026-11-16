import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { staffUser } from "@/db/schema";

import { createStaffAccount, normalizeUsername } from "./accounts";
import { createAuth } from "./auth";

export interface FirstOwnerInput {
  username: string;
  name: string;
  password: string;
}

export class OwnerExistsError extends Error {
  constructor() {
    super("An active owner already exists; refusing to create another.");
    this.name = "OwnerExistsError";
  }
}

export class UsernameTakenError extends Error {
  constructor(username: string) {
    super(`The username "${username}" is already taken.`);
    this.name = "UsernameTakenError";
  }
}

/**
 * Creates the very first owner, for a fresh production database where no one
 * can sign in yet. It refuses once any active owner exists, so it cannot be
 * used to mint a second one; the owner adds staff from the dashboard.
 */
export async function createFirstOwner(
  db: Database,
  input: FirstOwnerInput,
): Promise<{ id: string }> {
  const username = normalizeUsername(input.username);
  const [owner] = await db
    .select({ id: staffUser.id })
    .from(staffUser)
    .where(and(eq(staffUser.role, "owner"), eq(staffUser.active, true)))
    .limit(1);
  if (owner) throw new OwnerExistsError();

  const [taken] = await db
    .select({ id: staffUser.id })
    .from(staffUser)
    .where(eq(staffUser.username, username))
    .limit(1);
  if (taken) throw new UsernameTakenError(username);

  // Only the password hasher is used from this instance, so the secret and URL
  // never leave this process.
  const auth = createAuth(db, {
    secret: "owner-create-script-only-secret-not-used-for-sessions",
    baseURL: "http://localhost:3000",
  });
  return createStaffAccount(auth, {
    name: input.name,
    username,
    password: input.password,
    role: "owner",
  });
}
