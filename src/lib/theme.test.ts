// SPEC: docs/architecture/testing.md — unit tests for pure rules (ADR-028 theme)
// ROADMAP: phase-1-infrastructure / testing / Install Vitest + v8 coverage; add `test` and `coverage` scripts
import { describe, expect, it } from "vitest";

import {
  otherTheme,
  parseTheme,
  themeInitScript,
  THEME_STORAGE_KEY,
} from "./theme";

describe("theme", () => {
  it("treats only a stored 'dark' as dark", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("garbage")).toBe("light");
    expect(parseTheme(null)).toBe("light");
    expect(parseTheme(undefined)).toBe("light");
  });

  it("flips the theme", () => {
    expect(otherTheme("dark")).toBe("light");
    expect(otherTheme("light")).toBe("dark");
  });

  it("init script reads the same storage key", () => {
    expect(themeInitScript).toContain(THEME_STORAGE_KEY);
  });
});
