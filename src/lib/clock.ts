// The current time, injected. Services and operations read time only from a
// Clock they are given, never from `new Date()` or `Date.now()` (an ESLint rule
// enforces it), so a test can create a hold, advance 21 minutes and assert the
// slot is free without waiting (docs/architecture/testing.md).

export interface Clock {
  now(): Date;
}

/** The real clock. The only place server code is allowed to ask the system for the time. */
export const systemClock: Clock = {
  now: () => new Date(),
};

/** The venue's timezone. Every slot time and business date is read in it. */
export const VENUE_TIME_ZONE = "Africa/Cairo";
