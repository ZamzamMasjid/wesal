// Better Auth wiring for staff login (ADR-004, ADR-029). Users, sessions and the
// password credential live in our own Postgres through the Drizzle adapter.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { getDb, type Database } from "@/db/client";
import {
  staffAccount,
  staffSession,
  staffUser,
  staffVerification,
} from "@/db/schema";

export const LOGIN_PATH = "/sign-in/username";

export interface AuthConfig {
  secret: string;
  /** The public site URL, e.g. https://wesal.fly.dev. */
  baseURL: string;
  /** Tests turn this off so repeated sign-ins do not trip the limiter. */
  rateLimit?: boolean;
}

export function createAuth(db: Database, config: AuthConfig) {
  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: staffUser,
        session: staffSession,
        account: staffAccount,
        verification: staffVerification,
      },
    }),
    // Staff sign in with a username and password. There is no public sign-up:
    // the owner creates every account (createStaffAccount).
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [username({ displayUsername: false })],
    user: {
      modelName: "user",
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "staff",
          input: false,
        },
        active: {
          type: "boolean",
          required: true,
          defaultValue: true,
          input: false,
        },
        notifyPhone: { type: "string", required: false, input: false },
      },
    },
    session: {
      // A week, refreshed daily while in use. Sessions are checked against the
      // database on every request (no cookie cache), so a disabled account stops
      // working at once.
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    // Per process, which is enough while `web` is one machine (auth architecture).
    rateLimit: {
      enabled: config.rateLimit ?? true,
      storage: "memory",
      window: 60,
      max: 100,
      customRules: { [LOGIN_PATH]: { window: 60, max: 5 } },
    },
    databaseHooks: {
      session: {
        create: {
          // A disabled account cannot start a session.
          before: async (session) => {
            const [user] = await db
              .select({ active: staffUser.active })
              .from(staffUser)
              .where(eq(staffUser.id, session.userId));
            if (!user?.active) return false;
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

let shared: Auth | undefined;

/**
 * The app-wide instance, created on first use so that importing this module
 * (during `next build`, for instance) needs neither the database nor secrets.
 */
export function getAuth(): Auth {
  if (!shared) {
    const secret = process.env.BETTER_AUTH_SECRET;
    const baseURL = process.env.BETTER_AUTH_URL;
    if (!secret || !baseURL) {
      throw new Error(
        "BETTER_AUTH_SECRET and BETTER_AUTH_URL must be set. See .env.example.",
      );
    }
    shared = createAuth(getDb(), { secret, baseURL });
  }
  return shared;
}
