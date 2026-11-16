import type { Auth } from "./auth";

export type StaffRole = "owner" | "staff";

export interface NewStaffAccount {
  name: string;
  /** The login. Stored lowercase; unique. */
  username: string;
  password: string;
  role: StaffRole;
  notifyPhone?: string | null;
}

export const MIN_PASSWORD_LENGTH = 8;

/** The lowercase form every username is stored and compared in. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Better Auth requires an email on every user. Staff log in with a username, so
 * the email is a placeholder derived from it on a reserved (.invalid) domain,
 * which can never receive mail (ADR-029).
 */
export function internalEmail(normalizedUsername: string): string {
  return `${normalizedUsername}@staff.wesal.invalid`;
}

/**
 * Creates a staff user with a password credential. This is the only way an
 * account comes into existence: sign-up is disabled, so no request from the
 * public can reach it.
 */
export async function createStaffAccount(
  auth: Auth,
  input: NewStaffAccount,
): Promise<{ id: string }> {
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  const context = await auth.$context;
  const login = normalizeUsername(input.username);
  const user = await context.internalAdapter.createUser(
    {
      name: input.name,
      username: login,
      email: internalEmail(login),
      emailVerified: true,
      role: input.role,
      active: true,
      notifyPhone: input.notifyPhone ?? null,
    },
    { method: "email" },
  );
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: await context.password.hash(input.password),
  });
  return { id: user.id };
}
