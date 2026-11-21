// SPEC: docs/features/landing-page — videos stream with range requests and are cacheable
// ROADMAP: phase-5-public-site / landing-page / Serve media with range requests and caching headers
import { describe, expect, it } from "vitest";

import { contentRange, parseRange, unsatisfiedRange } from "./http-range";

describe("parseRange", () => {
  it("asks for the whole file without a usable header", () => {
    for (const header of [
      null,
      "",
      "items=0-1",
      "bytes=",
      "bytes=abc",
      "bytes=0-1,3-4",
    ]) {
      expect(parseRange(header, 100)).toEqual({ type: "full" });
    }
  });

  it("reads a closed range and clamps its end to the file", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({
      type: "partial",
      start: 0,
      end: 9,
    });
    expect(parseRange("bytes=90-200", 100)).toEqual({
      type: "partial",
      start: 90,
      end: 99,
    });
  });

  it("reads an open-ended range", () => {
    expect(parseRange("bytes=50-", 100)).toEqual({
      type: "partial",
      start: 50,
      end: 99,
    });
  });

  it("reads a suffix range", () => {
    expect(parseRange("bytes=-10", 100)).toEqual({
      type: "partial",
      start: 90,
      end: 99,
    });
    expect(parseRange("bytes=-200", 100)).toEqual({
      type: "partial",
      start: 0,
      end: 99,
    });
  });

  it("refuses a start past the end, a backwards range and an empty suffix", () => {
    expect(parseRange("bytes=100-", 100)).toEqual({ type: "unsatisfiable" });
    expect(parseRange("bytes=10-5", 100)).toEqual({ type: "unsatisfiable" });
    expect(parseRange("bytes=-0", 100)).toEqual({ type: "unsatisfiable" });
    expect(parseRange("bytes=0-1", 0)).toEqual({ type: "unsatisfiable" });
  });

  it("is case-insensitive about the unit", () => {
    expect(parseRange("BYTES=1-2", 10)).toEqual({
      type: "partial",
      start: 1,
      end: 2,
    });
  });
});

describe("content-range values", () => {
  it("names the returned slice and the file size", () => {
    expect(contentRange(2, 4, 10)).toBe("bytes 2-4/10");
    expect(unsatisfiedRange(10)).toBe("bytes */10");
  });
});
