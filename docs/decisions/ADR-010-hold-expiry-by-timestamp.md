---
id: ADR-010
type: adr
title: Expire holds by timestamp, not by a scheduled job
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-3-booking/booking-hold
mirror_id: ""
counterpart_adrs: []
---

# ADR-010: Expire holds by timestamp, not by a scheduled job

## Context

A hold must release itself after 20 minutes. The background loop runs inside the single app machine and pauses whenever that machine restarts.

## Decision

A hold counts only while its deadline is in the future. Every read and every write compares the deadline with the current time. Hold creation expires any overdue hold on the same time range inside its own transaction before inserting. A periodic sweep only updates stored status for tidiness.

## Rationale

Correctness does not depend on a job being on time or running at all. A slot is free at the deadline to the second.

## Alternatives considered

| Alternative | Why not |
|---|---|
| A scheduled job flips the status | Simpler queries, but a slot stays wrongly blocked whenever the job is late or not running. |

## Consequences

Every query that asks whether a slot is taken must include the deadline comparison; this is centralised in the service layer and covered by a test that runs with the job loop stopped. Stored status can lag reality by up to one sweep interval, which only the dashboard and reports see. Time comes from an injected clock so tests can move it.
