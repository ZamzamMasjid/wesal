// SPEC: docs/features/staff-access — arriving from a deep link while logged out shows the login form and then continues to the link
// ROADMAP: phase-2-foundations / staff-access / Implement dashboard shell and login screen in Arabic and English
import { describe, expect, it } from "vitest";

import { requestedPath, safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps dashboard paths", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/dashboard/bookings?id=3")).toBe(
      "/dashboard/bookings?id=3",
    );
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/dashboardx",
    "/dashboard//evil.example",
    "/dashboard\\evil",
    "/other",
  ])("falls back for %s", (value) => {
    expect(safeNext(value)).toBe("/dashboard");
  });
});

describe("requestedPath", () => {
  it("drops the English prefix and keeps the query", () => {
    expect(requestedPath("/en/dashboard/staff", "?a=1")).toBe(
      "/dashboard/staff?a=1",
    );
    expect(requestedPath("/dashboard", "")).toBe("/dashboard");
    expect(requestedPath("/en", "")).toBe("/");
  });
  it("does not strip a path that merely starts with en", () => {
    expect(requestedPath("/entrance", "")).toBe("/entrance");
  });
});
