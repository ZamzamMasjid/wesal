---
id: ADR-017
type: adr
title: Observe production through Fly logs only
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/deployment
mirror_id: ""
counterpart_adrs: []
---

# ADR-017: Observe production through Fly logs only

## Context

One developer operates the system. Failed messages, job errors and crashes need to be discoverable.

## Decision

All diagnostics go to the app's logs as structured lines, read with Fly's log tools. No error-tracking service and no in-dashboard alert page.

## Rationale

Nothing to set up and no additional account, which the user preferred.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Structured logs plus Sentry | Errors would reach the developer by email without watching logs; one more account. |
| Logs plus alerts inside the dashboard | Failures visible to the venue, but nothing reaches the developer unless someone looks. |

## Consequences

Problems are found when a user or the owner reports them or when the developer reads the logs. Log lines must therefore be structured and carry a request or job identifier so an incident can be traced after the fact.
