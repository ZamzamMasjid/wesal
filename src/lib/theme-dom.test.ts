// SPEC: docs/architecture/testing.md — unit tests for pure rules (ADR-028 theme persistence)
// ROADMAP: phase-1-infrastructure / testing / Install Vitest + v8 coverage; add `test` and `coverage` scripts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  readAppliedTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
} from "./theme";

// A minimal browser stand-in; component-level DOM tests arrive with the first
// feature views.
function stubBrowser(storage: Pick<Storage, "setItem">) {
  const dataset: Record<string, string> = {};
  const dispatched: string[] = [];
  vi.stubGlobal("document", { documentElement: { dataset } });
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", {
    dispatchEvent: (e: Event) => dispatched.push(e.type),
  });
  return { dataset, dispatched };
}

describe("applyTheme", () => {
  beforeEach(() =>
    vi.stubGlobal(
      "Event",
      class {
        constructor(public type: string) {}
      },
    ),
  );
  afterEach(() => vi.unstubAllGlobals());

  it("applies, remembers and announces the theme", () => {
    const setItem = vi.fn();
    const { dataset, dispatched } = stubBrowser({ setItem });
    applyTheme("dark");
    expect(dataset.theme).toBe("dark");
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "dark");
    expect(dispatched).toEqual([THEME_CHANGE_EVENT]);
    expect(readAppliedTheme()).toBe("dark");
  });

  it("still applies when storage is unavailable", () => {
    const { dataset } = stubBrowser({
      setItem: () => {
        throw new Error("denied");
      },
    });
    applyTheme("dark");
    expect(dataset.theme).toBe("dark");
  });
});
