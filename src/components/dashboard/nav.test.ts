// SPEC: docs/features/staff-access — the dashboard only shows a staff member what they are allowed to use
// ROADMAP: phase-2-foundations / staff-access / Implement dashboard shell and login screen in Arabic and English
import { describe, expect, it } from "vitest";

import { navFor } from "./nav";

describe("navFor", () => {
  it("shows the settings and staff pages to owners only", () => {
    expect(navFor("owner").map((i) => i.label)).toEqual([
      "home",
      "settings",
      "staff",
    ]);
    expect(navFor("staff").map((i) => i.label)).toEqual(["home"]);
  });
});
