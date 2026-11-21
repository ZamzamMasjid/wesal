// SPEC: docs/features/staff-access — the dashboard only shows a staff member what they are allowed to use
// ROADMAP: phase-2-foundations / staff-access / Implement dashboard shell and login screen in Arabic and English
import { describe, expect, it } from "vitest";

import { navFor } from "./nav";

describe("navFor", () => {
  it("shows review and bookings to everyone and content, settings, schedule and staff to owners only", () => {
    expect(navFor("owner").map((i) => i.label)).toEqual([
      "home",
      "review",
      "bookings",
      "content",
      "schedule",
      "settings",
      "staff",
    ]);
    expect(navFor("staff").map((i) => i.label)).toEqual([
      "home",
      "review",
      "bookings",
    ]);
  });
});
