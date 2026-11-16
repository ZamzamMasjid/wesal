// SPEC: staff-access/spec.md — there is no public sign-up; the owner creates accounts; there is always at least one active owner
// ROADMAP: phase-2-foundations / staff-access / Add `owner:create` script that creates the first owner on a fresh production database
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { staffUser } from "@/db/schema";
import { aStaffUser } from "@/test/factories";
import { openTestDb, resetDatabase } from "@/test/db";

import { createAuth, LOGIN_PATH } from "./auth";
import {
  createFirstOwner,
  OwnerExistsError,
  UsernameTakenError,
} from "./first-owner";

const handle = openTestDb();
const { db } = handle;

beforeEach(() => resetDatabase(handle));
afterAll(() => handle.pool.end());

describe("createFirstOwner", () => {
  it("creates an owner who can sign in", async () => {
    await createFirstOwner(db, {
      username: "Owner",
      name: "Venue Owner",
      password: "correct-horse",
    });
    const [row] = await db.select().from(staffUser);
    expect(row).toMatchObject({
      username: "owner",
      role: "owner",
      active: true,
    });

    const auth = createAuth(db, {
      secret: "test-secret-test-secret-test-secret-0123456789",
      baseURL: "http://localhost:3000",
      rateLimit: false,
    });
    const response = await auth.handler(
      new Request(`http://localhost:3000/api/auth${LOGIN_PATH}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ username: "owner", password: "correct-horse" }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("refuses when an active owner already exists", async () => {
    await db.insert(staffUser).values(aStaffUser({ role: "owner" }));
    await expect(
      createFirstOwner(db, {
        username: "second",
        name: "Second",
        password: "correct-horse",
      }),
    ).rejects.toBeInstanceOf(OwnerExistsError);
    expect(await db.select().from(staffUser)).toHaveLength(1);
  });

  it("creates an owner when the only owner is disabled", async () => {
    await db
      .insert(staffUser)
      .values(aStaffUser({ role: "owner", active: false }));
    await createFirstOwner(db, {
      username: "fresh",
      name: "Fresh",
      password: "correct-horse",
    });
    expect(await db.select().from(staffUser)).toHaveLength(2);
  });

  it("refuses a username that is already taken by staff", async () => {
    await db
      .insert(staffUser)
      .values(aStaffUser({ username: "sara", email: "sara@x.invalid" }));
    await expect(
      createFirstOwner(db, {
        username: "SARA",
        name: "Sara",
        password: "correct-horse",
      }),
    ).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it("rejects a short password and creates nothing", async () => {
    await expect(
      createFirstOwner(db, {
        username: "owner",
        name: "Owner",
        password: "short",
      }),
    ).rejects.toThrow(/at least/);
    expect(await db.select().from(staffUser)).toHaveLength(0);
  });
});
