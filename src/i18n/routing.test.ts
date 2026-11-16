// SPEC: docs/architecture/testing.md — Arabic (RTL) and English are both covered
// ROADMAP: phase-1-infrastructure / testing / Install Vitest + v8 coverage; add `test` and `coverage` scripts
import { describe, expect, it } from "vitest";

import { localeDirection, routing } from "./routing";

describe("routing", () => {
  it("defaults to Arabic and reads Arabic right-to-left", () => {
    expect(routing.defaultLocale).toBe("ar");
    expect(localeDirection("ar")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
  });
});
