---
id: testing
type: architecture
title: Testing Strategy
last_modified: 2026-11-15
---

# Testing Strategy

How this project tests its behavior. Every feature implementation follows these conventions: `axiom:section` reads this doc to write each item's unit/integration tests inline, and `axiom:test` reads it for e2e and backfill — both honor the framework, file layout, and coverage targets declared here.

## Pyramid

| Level | Target share | Purpose |
|---|---|---|
| Unit | 35% | Pure rules: slot resolution from pattern and exceptions, deposit calculation, hold deadline and cutoff, status transitions, message templates |
| Integration | 55% | JSON API endpoints against real Postgres and a temporary upload directory: the overlap constraint, expiry by timestamp, races, roles, outbox, purge |
| E2E | 10% | The booking journey and the staff review journey in a browser, in Arabic (RTL) and English |

The pyramid is integration-heavy on purpose. Wesal's risk is where the booking rules meet the database, and only a test against real Postgres can prove that two active bookings cannot overlap.

## Tooling

| Concern | Choice | Notes |
|---|---|---|
| Unit + integration runner | Vitest | TypeScript-native and fast (ADR-018) |
| E2E runner | Playwright | Multi-browser, mobile emulation, RTL screenshots (ADR-019) |
| Coverage | Vitest v8 coverage | Thresholds below |
| Assertions | Vitest `expect` | Testing Library for components |
| Mocking | Vitest `vi` | Philosophy: mock at boundaries only |
| Fixtures / factories | Hand-written builders in `src/test/` | `aBooking()`, `anOccasion()`, `aStaffUser()` with overridable fields |

**What is real and what is fake.** Postgres is real in integration tests (the docker-compose database). The filesystem is real, pointed at a temporary directory. Twilio is never called: the messaging adapter is replaced by the fake sender, which records what would have been sent and can be told to fail a channel. Time comes from the injected clock, so a test can create a hold, advance 21 minutes and assert the slot is free without waiting.

## Conventions

- **Location**: co-located — `src/services/booking.ts` beside `src/services/booking.test.ts`. E2E tests live in top-level `e2e/`.
- **Naming**: `*.test.ts` / `*.test.tsx` for unit and integration; `*.spec.ts` for e2e. Integration tests are named `*.int.test.ts` so the two Vitest projects can select them.
- **Fixtures live in**: `src/test/` — factories, the database helper, the fake clock, the fake sender.
- **Per-test isolation**: each integration test runs against a clean schema state (truncate between tests, or transaction rollback where the test does not itself need to commit). Race tests commit for real and clean up after themselves.

## Tests every booking change must keep green

These are the product's success criteria as tests; they are written once in phase 3 and never deleted.

- Two concurrent create-hold requests for one slot: exactly one succeeds, the other gets `SLOT_TAKEN`.
- A hold whose deadline has passed is reported free by the availability endpoint with the job loop stopped.
- A staff entry on a slot with an active hold is refused.
- A rejected or expired booking frees its slot at once.
- A hold cannot be created with a missing, expired or mismatched verified-phone token.
- A staff role cannot call an owner-only endpoint.

## Coverage targets

| Metric | Threshold | Gating |
|---|---|---|
| Lines | 80% | block |
| Branches | 70% | block |
| Statements | tracks lines | |

Exemptions: generated code, Drizzle migrations, type-only files, shadcn/ui component source copied into the repo, and configuration files.

## CI gating

- **PR checks**: lint, typecheck, `vitest run` (unit and integration with a Postgres service container) and the Playwright smoke suite on every push to a PR branch. CI is GitHub Actions.
- **Coverage check**: Vitest thresholds fail the run when lines fall below 80% or branches below 70%.
- **Failure policy**: block merge on any failure or coverage drop.
- **Flake handling**: no retries for unit and integration tests; fix the test. Playwright retries once in CI and reports the flake.

## Per-section test discipline

**Unit and integration tests are written by `axiom:section`, as part of each item's definition of done — not as a separate follow-up step.** An item isn't done until its unit/integration coverage exists and passes. `axiom:test` owns **e2e** (derived from the spec) and the **backfill** of unit/integration on sections shipped before this discipline existed.

What `axiom:section` produces inline per item:

- **Backend item** → integration tests for new endpoints + unit tests for non-trivial logic
- **Frontend item** → component tests for the new view/components, in both directions where layout differs
- **Infrastructure / config item** → smoke check that the substrate (database connection, CI workflow, health endpoint) actually works; usually no spec-traced tests
- **Job-loop item** → integration test driving the job once with the fake clock

What `axiom:test` produces separately:

- **E2E** for the primary user flows: home to uploaded proof, and staff review to confirm or reject
- **Backfill** unit/integration for coverage gaps `axiom:review` flags

## Spec traceability

Every test carries a header that traces to its requirement:

```
// SPEC: <feature-id>/spec.md — <requirement summary>
// ROADMAP: <phase-id> / <section-slug> / <item text>
```

`axiom:section` (unit/integration) and `axiom:test` (e2e/backfill) both enforce this convention. Tests without traceability are flagged by `axiom:review`.
