// SPEC: docs/architecture/testing.md — infrastructure smoke check: database client configuration
// ROADMAP: phase-1-infrastructure / testing / Add test scaffold under src/test: factories, database helper, fake clock, fake sender
import { describe, expect, it } from "vitest";

import { requireDatabaseUrl } from "./client";

describe("requireDatabaseUrl", () => {
  it("returns DATABASE_URL when set", () => {
    expect(requireDatabaseUrl({ DATABASE_URL: "postgres://x" })).toBe(
      "postgres://x",
    );
  });

  it("explains how to fix a missing DATABASE_URL", () => {
    expect(() => requireDatabaseUrl({})).toThrow(/DATABASE_URL is not set/);
  });
});
