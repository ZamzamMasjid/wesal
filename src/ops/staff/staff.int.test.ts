// SPEC: docs/features/staff-access — owner creates, disables and resets staff accounts; last owner is protected; every action is audited; audit rows are never edited or deleted
// ROADMAP: phase-2-foundations / staff-access / Implement staff account management for the owner; Implement audit-log table and helper recording every staff action
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { resolveCaller, type Caller } from "@/api/caller";
import { createCallContext } from "@/api/context";
import { createStaffAccount } from "@/auth/accounts";
import { createAuth, LOGIN_PATH } from "@/auth/auth";
import { auditLog, staffSession } from "@/db/schema";
import { recordAudit } from "@/audit/audit";
import { openTestDb, resetDatabase } from "@/test/db";
import { createFakeClock } from "@/test/fake-clock";

import { createStaffOperations } from "./staff";

const handle = openTestDb();
const { db } = handle;
const auth = createAuth(db, {
  secret: "test-secret-test-secret-test-secret-0123456789",
  baseURL: "http://localhost:3000",
  rateLimit: false,
});
const ops = createStaffOperations(() => ({ db, auth }));
const clock = createFakeClock();

beforeEach(() => resetDatabase(handle));
afterAll(() => handle.pool.end());

const ctx = (caller: Caller) => createCallContext(caller, { requestId: "r" });

async function makeOwner(username = "owner") {
  const { id } = await createStaffAccount(auth, {
    name: "Owner",
    username,
    password: "correct-horse",
    role: "owner",
  });
  return { id, caller: { kind: "staff", userId: id, role: "owner" } as Caller };
}

async function signIn(username: string, password: string) {
  const response = await auth.handler(
    new Request(`http://localhost:3000/api/auth${LOGIN_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ username, password }),
    }),
  );
  const cookie = (response.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  return { response, cookie };
}

describe("staff.users.create", () => {
  it("creates a staff account that can sign in, and audits it", async () => {
    const owner = await makeOwner();
    const result = await ops.createUser(
      { name: "Sara", username: "Sara", password: "initial-pass" },
      ctx(owner.caller),
    );
    expect(result.ok && result.data).toMatchObject({
      username: "sara",
      role: "staff",
      active: true,
    });
    expect((await signIn("sara", "initial-pass")).response.status).toBe(200);

    const audit = await ops.audit({}, ctx(owner.caller));
    expect(audit.ok && audit.data.entries[0]).toMatchObject({
      action: "staff.create",
      actorId: owner.id,
    });
  });

  it("rejects a taken login", async () => {
    const owner = await makeOwner();
    const input = { name: "A", username: "sara", password: "initial-pass" };
    await ops.createUser(input, ctx(owner.caller));
    const again = await ops.createUser(input, ctx(owner.caller));
    expect(!again.ok && again.error.code).toBe("USERNAME_TAKEN");
  });

  it("rejects a short password and a malformed login", async () => {
    const owner = await makeOwner();
    const short = await ops.createUser(
      { name: "A", username: "sara", password: "short" },
      ctx(owner.caller),
    );
    expect(!short.ok && short.error.code).toBe("VALIDATION_FAILED");
    const bad = await ops.createUser(
      { name: "A", username: "s a!", password: "initial-pass" },
      ctx(owner.caller),
    );
    expect(!bad.ok && bad.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("staff.users.update", () => {
  async function withStaff() {
    const owner = await makeOwner();
    const created = await ops.createUser(
      { name: "Sara", username: "sara", password: "initial-pass" },
      ctx(owner.caller),
    );
    if (!created.ok) throw new Error("setup failed");
    return { owner, staffId: created.data.id };
  }

  it("disabling takes effect at once for an open session", async () => {
    const { owner, staffId } = await withStaff();
    const { cookie } = await signIn("sara", "initial-pass");
    const request = new Request("http://localhost:3000/x", {
      headers: { cookie },
    });
    expect((await resolveCaller(request, auth)).kind).toBe("staff");

    const result = await ops.updateUser(
      { id: staffId, active: false },
      ctx(owner.caller),
    );
    expect(result.ok && result.data.active).toBe(false);
    expect(await resolveCaller(request, auth)).toEqual({ kind: "anonymous" });
    expect(
      await db
        .select()
        .from(staffSession)
        .where(eq(staffSession.userId, staffId)),
    ).toHaveLength(0);
    expect((await signIn("sara", "initial-pass")).response.status).not.toBe(
      200,
    );
  });

  it("reset password ends sessions and the new password works", async () => {
    const { owner, staffId } = await withStaff();
    const { cookie } = await signIn("sara", "initial-pass");
    await ops.updateUser(
      { id: staffId, password: "brand-new-pass" },
      ctx(owner.caller),
    );
    const request = new Request("http://localhost:3000/x", {
      headers: { cookie },
    });
    expect((await resolveCaller(request, auth)).kind).toBe("anonymous");
    expect((await signIn("sara", "initial-pass")).response.status).not.toBe(
      200,
    );
    expect((await signIn("sara", "brand-new-pass")).response.status).toBe(200);
    const audit = await ops.audit({}, ctx(owner.caller));
    expect(audit.ok && audit.data.entries.map((e) => e.action)).toContain(
      "staff.reset_password",
    );
  });

  it("audits disable, enable and edits", async () => {
    const { owner, staffId } = await withStaff();
    await ops.updateUser({ id: staffId, active: false }, ctx(owner.caller));
    await ops.updateUser({ id: staffId, active: true }, ctx(owner.caller));
    await ops.updateUser({ id: staffId, name: "Sara K" }, ctx(owner.caller));
    const audit = await ops.audit({}, ctx(owner.caller));
    expect(audit.ok && audit.data.entries.map((e) => e.action)).toEqual([
      "staff.update",
      "staff.enable",
      "staff.disable",
      "staff.create",
    ]);
  });

  it("refuses to disable or demote the last active owner", async () => {
    const owner = await makeOwner();
    const disable = await ops.updateUser(
      { id: owner.id, active: false },
      ctx(owner.caller),
    );
    expect(!disable.ok && disable.error.code).toBe("LAST_OWNER");
    const demote = await ops.updateUser(
      { id: owner.id, role: "staff" },
      ctx(owner.caller),
    );
    expect(!demote.ok && demote.error.code).toBe("LAST_OWNER");
  });

  it("allows demoting an owner when another active owner exists", async () => {
    const first = await makeOwner("first");
    const second = await makeOwner("second");
    const result = await ops.updateUser(
      { id: first.id, role: "staff" },
      ctx(second.caller),
    );
    expect(result.ok && result.data.role).toBe("staff");
  });

  it("returns NOT_FOUND for an unknown account", async () => {
    const owner = await makeOwner();
    const result = await ops.updateUser(
      { id: "nope", active: false },
      ctx(owner.caller),
    );
    expect(!result.ok && result.error.code).toBe("NOT_FOUND");
  });

  it("rejects an empty change", async () => {
    const owner = await makeOwner();
    const result = await ops.updateUser({ id: owner.id }, ctx(owner.caller));
    expect(!result.ok && result.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("staff.me and staff.users.list", () => {
  it("me returns the caller's profile without secrets", async () => {
    const owner = await makeOwner();
    const result = await ops.me({}, ctx(owner.caller));
    expect(result.ok && result.data).toMatchObject({
      id: owner.id,
      username: "owner",
      role: "owner",
    });
    expect(result.ok && Object.keys(result.data)).not.toContain("email");
  });

  it("list returns accounts for the owner only", async () => {
    const owner = await makeOwner();
    const listed = await ops.listUsers({}, ctx(owner.caller));
    expect(listed.ok && listed.data.users).toHaveLength(1);
    const asStaff = await ops.listUsers(
      {},
      ctx({ kind: "staff", userId: "x", role: "staff" }),
    );
    expect(!asStaff.ok && asStaff.error.code).toBe("FORBIDDEN");
  });
});

describe("staff.me.notifications", () => {
  it("lets a staff member set their own phone, opt-in and alert language", async () => {
    const owner = await makeOwner();
    const created = await ops.createUser(
      { name: "Sara", username: "sara", password: "initial-pass" },
      ctx(owner.caller),
    );
    if (!created.ok) throw new Error("setup failed");
    const staffCaller: Caller = {
      kind: "staff",
      userId: created.data.id,
      role: "staff",
    };

    const result = await ops.updateNotifications(
      {
        notifyPhone: "+201001111111",
        notifyEnabled: false,
        locale: "en",
      },
      ctx(staffCaller),
    );
    expect(result.ok && result.data).toMatchObject({
      id: created.data.id,
      notifyPhone: "+201001111111",
      notifyEnabled: false,
      locale: "en",
    });

    const audit = await ops.audit({}, ctx(owner.caller));
    expect(audit.ok && audit.data.entries[0]).toMatchObject({
      action: "staff.notify_update",
      actorId: created.data.id,
      detail: {
        notifyPhone: "changed",
        notifyEnabled: { from: true, to: false },
        locale: { from: "ar", to: "en" },
      },
    });
  });

  it("clears the phone and rejects a malformed one", async () => {
    const owner = await makeOwner();
    const cleared = await ops.updateNotifications(
      { notifyPhone: null, notifyEnabled: true },
      ctx(owner.caller),
    );
    expect(cleared.ok && cleared.data.notifyPhone).toBeNull();

    const bad = await ops.updateNotifications(
      { notifyPhone: "12", notifyEnabled: true },
      ctx(owner.caller),
    );
    expect(!bad.ok && bad.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("staff.users.update notification settings", () => {
  it("lets the owner set a staff member's alert phone and opt-in", async () => {
    const owner = await makeOwner();
    const created = await ops.createUser(
      { name: "Sara", username: "sara", password: "initial-pass" },
      ctx(owner.caller),
    );
    if (!created.ok) throw new Error("setup failed");

    const result = await ops.updateUser(
      {
        id: created.data.id,
        notifyPhone: "+201002222222",
        notifyEnabled: false,
      },
      ctx(owner.caller),
    );
    expect(result.ok && result.data).toMatchObject({
      notifyPhone: "+201002222222",
      notifyEnabled: false,
      locale: "ar",
    });

    const audit = await ops.audit({}, ctx(owner.caller));
    expect(audit.ok && audit.data.entries[0]).toMatchObject({
      action: "staff.update",
      detail: {
        notifyPhone: "changed",
        notifyEnabled: { from: true, to: false },
      },
    });
  });

  it("creates a staff account with alerts off when asked", async () => {
    const owner = await makeOwner();
    const created = await ops.createUser(
      {
        name: "Sara",
        username: "sara",
        password: "initial-pass",
        notifyEnabled: false,
      },
      ctx(owner.caller),
    );
    expect(created.ok && created.data.notifyEnabled).toBe(false);
  });
});

describe("audit log", () => {
  it("records time from the injected clock and filters by booking", async () => {
    const owner = await makeOwner();
    await recordAudit(db, clock, {
      actorId: owner.id,
      action: "booking.confirm",
      bookingId: 7,
      detail: { from: "proof_submitted", to: "confirmed" },
    });
    await recordAudit(db, clock, { actorId: owner.id, action: "other" });
    const result = await ops.audit({ bookingId: "7" }, ctx(owner.caller));
    expect(result.ok && result.data.entries).toHaveLength(1);
    expect(result.ok && result.data.entries[0]).toMatchObject({
      action: "booking.confirm",
      at: clock.now().toISOString(),
      detail: { to: "confirmed" },
    });
  });

  it("refuses to update or delete a row", async () => {
    const owner = await makeOwner();
    await recordAudit(db, clock, { actorId: owner.id, action: "x" });
    await expect(db.update(auditLog).set({ action: "y" })).rejects.toThrow();
    await expect(db.delete(auditLog)).rejects.toThrow();
    expect(await db.select().from(auditLog)).toHaveLength(1);
  });
});
