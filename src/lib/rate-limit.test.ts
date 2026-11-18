// SPEC: docs/features/phone-verification — requests are rate-limited per phone and per IP
// ROADMAP: phase-2-foundations / phone-verification / Implement request-code endpoint: hashed code, expiry, rate limits per phone and IP
import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit";

const start = new Date("2026-01-01T10:00:00Z");
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);
const rule = { limit: 2, windowSeconds: 60 };

describe("createRateLimiter", () => {
  it("allows the limit, then reports the wait until the oldest attempt ages out", () => {
    const limiter = createRateLimiter();
    expect(limiter.retryAfter("k", rule, at(0))).toBe(0);
    limiter.record("k", rule, at(0));
    expect(limiter.retryAfter("k", rule, at(10))).toBe(0);
    limiter.record("k", rule, at(10));
    expect(limiter.retryAfter("k", rule, at(10))).toBe(50);
    expect(limiter.retryAfter("k", rule, at(40))).toBe(20);
    expect(limiter.retryAfter("k", rule, at(59))).toBe(1);
    expect(limiter.retryAfter("k", rule, at(60))).toBe(0);
  });

  it("keeps keys independent and forgets an empty key", () => {
    const limiter = createRateLimiter();
    limiter.record("a", rule, at(0));
    limiter.record("a", rule, at(0));
    expect(limiter.retryAfter("b", rule, at(0))).toBe(0);
    expect(limiter.retryAfter("a", rule, at(61))).toBe(0);
    expect(limiter.retryAfter("a", rule, at(0))).toBe(0);
  });

  it("can be reset", () => {
    const limiter = createRateLimiter();
    limiter.record("k", rule, at(0));
    limiter.record("k", rule, at(0));
    expect(limiter.retryAfter("k", rule, at(0))).toBeGreaterThan(0);
    limiter.reset();
    expect(limiter.retryAfter("k", rule, at(0))).toBe(0);
  });
});
