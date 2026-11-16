// SPEC: staff-access/spec.md — staff log in with a login and password; accounts are created by the owner only
// ROADMAP: phase-2-foundations / staff-access / Integrate Better Auth with password login and Drizzle-backed sessions
import { describe, expect, it } from "vitest";

import { internalEmail, normalizeUsername } from "./accounts";

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Owner ")).toBe("owner");
  });
});

describe("internalEmail", () => {
  it("uses a reserved domain that can never receive mail", () => {
    expect(internalEmail("owner")).toBe("owner@staff.wesal.invalid");
    expect(internalEmail("owner")).toMatch(/\.invalid$/);
  });
});
