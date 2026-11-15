---
id: ADR-018
type: adr
title: Use Vitest for unit and integration tests
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/testing
mirror_id: ""
counterpart_adrs: []
---

# ADR-018: Use Vitest for unit and integration tests

## Context

The testing strategy is integration-heavy: most confidence comes from tests that run the JSON API against real PostgreSQL. The runner must handle TypeScript natively and run two kinds of project.

## Decision

Use Vitest with v8 coverage, configured as two projects: unit, and integration against real Postgres. Thresholds are 80% lines and 70% branches, blocking in CI.

## Rationale

TypeScript-native and fast, and already used in the developer's other web project.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Jest | Slower with TypeScript and ESM. |
| node:test | No dependency, but fewer conveniences for mocking, projects and coverage. |

## Consequences

Integration tests need a Postgres service in CI and locally. Only the messaging provider is faked; time comes from an injected clock. See docs/architecture/testing.md.
