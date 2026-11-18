import { getAuth, type Auth } from "@/auth/auth";
import type { Clock } from "@/lib/clock";
import type { Logger } from "@/lib/logger";

// Who is calling an operation. Authorization is decided inside the operation
// (docs/architecture/auth.md), never in the HTTP wrapper or in a page.

/**
 * - anonymous: no proof. A booking holder is also `anonymous` here; the holder's
 *   link token or booking ID is part of the operation's input and is checked by
 *   the operation itself.
 * - staff: a Better Auth session with an active account.
 */
export type Caller =
  | { kind: "anonymous" }
  | { kind: "staff"; userId: string; role: "staff" | "owner" };

export type AccessLevel = "anonymous" | "holder" | "staff" | "owner";

export interface CallContext {
  caller: Caller;
  requestId: string;
  /** The current time; the only clock operations and services may use. */
  clock: Clock;
  /** A logger whose lines all carry this call's requestId. */
  log: Logger;
  /** The caller's address, when the HTTP layer could determine it. */
  ip?: string;
}

export const ANONYMOUS: Caller = { kind: "anonymous" };

/**
 * Whether `caller` may call an operation that declares `access`. A missing or
 * unrecognised caller never passes a staff or owner check: there is no
 * fail-open path.
 */
export function authorize(
  access: AccessLevel,
  caller: Caller,
): "allowed" | "unauthenticated" | "forbidden" {
  switch (access) {
    case "anonymous":
    case "holder":
      return "allowed";
    case "staff":
      return caller.kind === "staff" ? "allowed" : "unauthenticated";
    case "owner":
      if (caller.kind !== "staff") return "unauthenticated";
      return caller.role === "owner" ? "allowed" : "forbidden";
    default:
      return "forbidden";
  }
}

/**
 * Works out the caller for an incoming request from its Better Auth session
 * cookie. The session is looked up in the database every time and the account
 * must still be active, so disabling an account takes effect at once. Anything
 * missing, invalid, expired or unreadable is anonymous: there is no fail-open
 * path, and an unreachable database denies rather than allows.
 */
export async function resolveCaller(
  request: Request,
  auth?: Auth,
): Promise<Caller> {
  try {
    const session = await (auth ?? getAuth()).api.getSession({
      headers: request.headers,
    });
    if (!session) return ANONYMOUS;
    const { id, role, active } = session.user;
    if (!active || (role !== "owner" && role !== "staff")) return ANONYMOUS;
    return { kind: "staff", userId: id, role };
  } catch {
    return ANONYMOUS;
  }
}
