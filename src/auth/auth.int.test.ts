// SPEC: staff-access/spec.md — owner and staff log in with a login and password; no public sign-up; sessions are HTTP-only cookies; a missing or invalid session always denies
// ROADMAP: phase-2-foundations / staff-access / Integrate Better Auth with password login and Drizzle-backed sessions
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { resolveCaller } from "@/api/caller";
import { staffAccount, staffSession, staffUser } from "@/db/schema";
import { openTestDb, resetDatabase } from "@/test/db";

import { createStaffAccount } from "./accounts";
import { createAuth, LOGIN_PATH } from "./auth";

const handle = openTestDb();
const { db } = handle;
const auth = createAuth(db, {
  secret: "test-secret-test-secret-test-secret-0123456789",
  baseURL: "http://localhost:3000",
  rateLimit: false,
});

beforeEach(() => resetDatabase(handle));
afterAll(() => handle.pool.end());

function post(path: string, body: unknown): Request {
  return new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

/** Signs in over HTTP and returns the response and the cookie to send back. */
async function signIn(username: string, password: string) {
  const response = await auth.handler(post(LOGIN_PATH, { username, password }));
  const cookie = (response.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  return { response, cookie };
}

function withCookie(cookie: string): Request {
  return new Request("http://localhost:3000/api/v1/x", { headers: { cookie } });
}

describe("staff login", () => {
  it("signs in with a username and password and resolves the caller", async () => {
    const { id } = await createStaffAccount(auth, {
      name: "Owner",
      username: "Owner",
      password: "correct-horse",
      role: "owner",
    });
    const { response, cookie } = await signIn("owner", "correct-horse");
    expect(response.status).toBe(200);
    expect(await resolveCaller(withCookie(cookie), auth)).toEqual({
      kind: "staff",
      userId: id,
      role: "owner",
    });
  });

  it("matches the username without regard to case", async () => {
    await createStaffAccount(auth, {
      name: "Sara",
      username: "Sara",
      password: "correct-horse",
      role: "staff",
    });
    const { response } = await signIn("SARA", "correct-horse");
    expect(response.status).toBe(200);
  });

  it("sets an HTTP-only session cookie and stores the session in the database", async () => {
    await createStaffAccount(auth, {
      name: "Sara",
      username: "sara",
      password: "correct-horse",
      role: "staff",
    });
    const { response } = await signIn("sara", "correct-horse");
    const setCookie = response.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(await db.select().from(staffSession)).toHaveLength(1);
  });

  it("rejects a wrong password and a wrong username the same way", async () => {
    await createStaffAccount(auth, {
      name: "Sara",
      username: "sara",
      password: "correct-horse",
      role: "staff",
    });
    const wrongPassword = await signIn("sara", "wrong-password");
    const wrongUser = await signIn("nobody", "correct-horse");
    expect(wrongPassword.response.status).toBe(401);
    expect(wrongUser.response.status).toBe(401);
    expect(await wrongPassword.response.json()).toEqual(
      await wrongUser.response.json(),
    );
    expect(await db.select().from(staffSession)).toHaveLength(0);
  });

  it("stores only a hash of the password", async () => {
    await createStaffAccount(auth, {
      name: "Sara",
      username: "sara",
      password: "correct-horse",
      role: "staff",
    });
    const [account] = await db.select().from(staffAccount);
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain("correct-horse");
  });

  it("refuses to create an account with a short password", async () => {
    await expect(
      createStaffAccount(auth, {
        name: "Sara",
        username: "sara",
        password: "short",
        role: "staff",
      }),
    ).rejects.toThrow(/at least/);
    expect(await db.select().from(staffUser)).toHaveLength(0);
  });
});

describe("no public sign-up", () => {
  it("rejects the email sign-up route", async () => {
    const response = await auth.handler(
      post("/sign-up/email", {
        email: "x@example.com",
        name: "X",
        password: "correct-horse",
        username: "x",
      }),
    );
    expect(response.ok).toBe(false);
    expect(await db.select().from(staffUser)).toHaveLength(0);
  });
});

describe("resolveCaller", () => {
  it("is anonymous without a cookie", async () => {
    expect(
      await resolveCaller(new Request("http://localhost:3000/x"), auth),
    ).toEqual({ kind: "anonymous" });
  });

  it("is anonymous for a cookie that is not a valid session", async () => {
    expect(
      await resolveCaller(
        withCookie("better-auth.session_token=forged.value"),
        auth,
      ),
    ).toEqual({ kind: "anonymous" });
  });

  it("stops recognising a user the moment the account is disabled", async () => {
    const { id } = await createStaffAccount(auth, {
      name: "Sara",
      username: "sara",
      password: "correct-horse",
      role: "staff",
    });
    const { cookie } = await signIn("sara", "correct-horse");
    expect(await resolveCaller(withCookie(cookie), auth)).toMatchObject({
      kind: "staff",
    });
    await db
      .update(staffUser)
      .set({ active: false })
      .where(eq(staffUser.id, id));
    expect(await resolveCaller(withCookie(cookie), auth)).toEqual({
      kind: "anonymous",
    });
  });

  it("is anonymous once the session has expired", async () => {
    await createStaffAccount(auth, {
      name: "Sara",
      username: "sara",
      password: "correct-horse",
      role: "staff",
    });
    const { cookie } = await signIn("sara", "correct-horse");
    await db
      .update(staffSession)
      .set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await resolveCaller(withCookie(cookie), auth)).toEqual({
      kind: "anonymous",
    });
  });

  it("is anonymous when the session store cannot be read", async () => {
    const broken = {
      api: {
        getSession: async () => {
          throw new Error("database down");
        },
      },
    } as never;
    expect(await resolveCaller(new Request("http://x/"), broken)).toEqual({
      kind: "anonymous",
    });
  });
});

describe("disabled accounts", () => {
  it("cannot start a session", async () => {
    const { id } = await createStaffAccount(auth, {
      name: "Sara",
      username: "sara",
      password: "correct-horse",
      role: "staff",
    });
    await db
      .update(staffUser)
      .set({ active: false })
      .where(eq(staffUser.id, id));
    const { response } = await signIn("sara", "correct-horse");
    expect(response.ok).toBe(false);
    expect(await db.select().from(staffSession)).toHaveLength(0);
  });
});

describe("login rate limit", () => {
  it("blocks repeated attempts from one client", async () => {
    const limited = createAuth(db, {
      secret: "test-secret-test-secret-test-secret-0123456789",
      baseURL: "http://localhost:3000",
      rateLimit: true,
    });
    const attempt = () =>
      limited.handler(
        new Request(`http://localhost:3000/api/auth${LOGIN_PATH}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            "x-forwarded-for": "203.0.113.7",
          },
          body: JSON.stringify({
            username: "sara",
            password: "wrong-password",
          }),
        }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await attempt()).status);
    expect(statuses).toContain(429);
  });
});
