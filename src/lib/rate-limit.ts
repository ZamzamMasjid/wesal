// A small in-process sliding-window rate limiter (docs/architecture/auth.md:
// limits are per process, which is enough while `web` is one machine). Callers
// check every rule first and record only when all of them allow the attempt, so
// a refused request never extends the window.

export interface RateLimitRule {
  /** Attempts allowed inside the window. */
  limit: number;
  windowSeconds: number;
}

export interface RateLimiter {
  /** Seconds to wait before `key` may attempt again under `rule`; 0 when allowed. */
  retryAfter(key: string, rule: RateLimitRule, now: Date): number;
  /** Records an allowed attempt. Call only after every `retryAfter` returned 0. */
  record(key: string, rule: RateLimitRule, now: Date): void;
  /** Forgets every key. Tests use it; production never does. */
  reset(): void;
}

export function createRateLimiter(): RateLimiter {
  const hits = new Map<string, number[]>();

  function recent(key: string, rule: RateLimitRule, now: Date): number[] {
    const cutoff = now.getTime() - rule.windowSeconds * 1000;
    const times = hits.get(key) ?? [];
    let first = 0;
    while (first < times.length && times[first]! <= cutoff) first += 1;
    if (first > 0) times.splice(0, first);
    if (times.length === 0) {
      hits.delete(key);
      return [];
    }
    hits.set(key, times);
    return times;
  }

  return {
    retryAfter(key, rule, now) {
      const times = recent(key, rule, now);
      if (times.length < rule.limit) return 0;
      const oldest = times[0]!;
      const waitMs = oldest + rule.windowSeconds * 1000 - now.getTime();
      return Math.max(1, Math.ceil(waitMs / 1000));
    },

    record(key, rule, now) {
      const times = recent(key, rule, now);
      times.push(now.getTime());
      hits.set(key, times);
    },

    reset() {
      hits.clear();
    },
  };
}
