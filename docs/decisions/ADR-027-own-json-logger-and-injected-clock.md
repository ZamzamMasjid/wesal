---
id: ADR-027
type: adr
title: Write a small JSON logger and take time from an injected clock
last_modified: 2026-11-16
decision_status: Accepted
phase_section: phase-1-infrastructure/project-setup
mirror_id: ""
counterpart_adrs: []
---

# ADR-027: Write a small JSON logger and take time from an injected clock

## Context

ADR-017 makes the app's logs the only diagnostics, read with Fly's log tools, so lines must be structured and carry a request or job identifier. The overview requires every job run, message failure and unhandled error to write one such line. Business time is the venue's (Africa/Cairo), and ADR-010 and the testing strategy need tests that move time without waiting, so services must not read the system clock themselves. The system also handles customer phone numbers, one-time codes and tokens that must not appear in logs.

## Decision

`src/lib/logger.ts` is a small logger that writes one JSON object per line to stdout with `level`, `time` and `msg`, plus bound fields. `child({ requestId })` or `child({ jobId })` returns a logger that adds those fields to every line. Fields named `level`, `time` or `msg` are kept as `_level`, `_time` and `_msg` so they cannot overwrite the line's own. Errors serialize to name, message, stack, code and cause; `bigint` becomes a string; circular references become `"[Circular]"`; a field that still cannot be serialized never throws. Values under the keys `phone`, `code`, `token`, `password`, `authorization`, `cookie` and a few similar names are replaced with `"[redacted]"` at any depth. The minimum level comes from `LOG_LEVEL` (default `info`).

`src/lib/clock.ts` defines `Clock { now(): Date }` and the `systemClock`. The logger and `CallContext` take a clock; `src/lib/runtime.ts` wires the production clock and logger, and tests substitute their own. `createCallContext` builds the context an operation runs with, for the HTTP route and for in-process page calls alike, with a logger already bound to the request id.

ESLint enforces both: `no-console` everywhere, and in server code (`src/api`, `src/lib`, `src/services`, `src/operations`, `src/jobs`) `new Date()` without arguments and `Date.now()` are errors, except in `src/lib/clock.ts` and in tests.

## Rationale

Fly captures stdout, so a JSON line per event is all ADR-017 needs. The needed behavior is small and fully specified here, and owning it keeps the clock injectable into the logger, avoids bundling and worker-thread issues that logging libraries can have under Next.js, and adds no dependency. Redacting by key name makes the privacy rule hold even when a caller forgets. Lint rules turn "services use the injected clock" from a convention into a gate that CI already runs.

## Alternatives considered

| Alternative | Why not |
|---|---|
| pino | The standard choice and faster, but it needs its own handling under Next.js bundling, its timestamps come from the system clock, and this app logs a few lines a minute at most. |
| `console.log` of JSON in each place | No shared fields, no redaction, no level filtering, and lines would drift in shape. |
| A global clock that tests replace | Hidden shared state; parallel tests would interfere. |

## Consequences

Services and operations receive a clock and logger through `CallContext` (or `Runtime`) instead of importing them, so every test passes its own. Redaction is by key name, so a secret placed under another key is not caught; new sensitive keys are added to the list in `logger.ts`. The browser keeps its own time for countdowns and is outside the clock rule. The fake clock and a collecting logger are part of the test scaffold in the testing section. If log volume or performance ever matters, the `Logger` interface lets pino replace the implementation without touching callers.
