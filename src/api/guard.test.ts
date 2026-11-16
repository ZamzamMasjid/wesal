// SPEC: docs/architecture/auth.md — every staff endpoint passes one authorization guard; owner-only endpoints are owner-only; a missing session always denies
// ROADMAP: phase-2-foundations / staff-access / Add owner and staff roles with an API authorization guard
import { describe, expect, it } from "vitest";

import { operations } from "@/ops/registry";

import type { Caller } from "./caller";
import { createCallContext } from "./context";

const ctx = (caller: Caller) => createCallContext(caller, { requestId: "r" });
const anon: Caller = { kind: "anonymous" };
const staff: Caller = { kind: "staff", userId: "s", role: "staff" };

const guarded = operations.filter((o) => o.access === "owner");
const staffLevel = operations.filter((o) => o.access === "staff");

describe("authorization guard, for every registered operation", () => {
  it("registers at least the owner-only staff operations", () => {
    expect(guarded.map((o) => o.operationName)).toEqual(
      expect.arrayContaining([
        "staff.users.list",
        "staff.users.create",
        "staff.users.update",
        "staff.audit.list",
      ]),
    );
  });

  it.each(guarded.map((o) => [o.operationName, o] as const))(
    "%s refuses staff with FORBIDDEN and anonymous with UNAUTHENTICATED",
    async (_name, operation) => {
      const asStaff = await operation({}, ctx(staff));
      expect(!asStaff.ok && asStaff.error.code).toBe("FORBIDDEN");
      const asAnon = await operation({}, ctx(anon));
      expect(!asAnon.ok && asAnon.error.code).toBe("UNAUTHENTICATED");
    },
  );

  it.each(staffLevel.map((o) => [o.operationName, o] as const))(
    "%s refuses anonymous with UNAUTHENTICATED",
    async (_name, operation) => {
      const result = await operation({}, ctx(anon));
      expect(!result.ok && result.error.code).toBe("UNAUTHENTICATED");
    },
  );
});
