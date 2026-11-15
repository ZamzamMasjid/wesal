---
id: ADR-009
type: adr
title: Run one app machine with in-process jobs
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/deployment
mirror_id: ""
counterpart_adrs: []
---

# ADR-009: Run one app machine with in-process jobs

## Context

Besides serving requests, the system sends queued messages, tidies expired holds and purges old screenshots on a timer. Constraints: one developer, small traffic, short outages acceptable, and files on a volume that attaches to a single machine.

## Decision

One always-on Next.js machine serves the site, the dashboard and the JSON API, and runs the timed jobs in a loop inside the same process.

## Rationale

It is the smallest shape that meets the stated constraints: lowest cost and least to operate. Because hold expiry is decided by timestamp (ADR-010), a paused job loop never makes a booking wrong, only delays messages and housekeeping.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Web plus a separate worker process | Jobs would survive web restarts and never slow pages, but it is a second machine to pay for and watch, and the worker could not reach the upload volume. |
| Front end plus a separate API service | The cleanest boundary for the later mobile app, but two deployables and an internal contract to maintain from day one for one developer. |

## Consequences

A crash or deploy pauses message sending and the purge along with the site for a few minutes. A heavy job could slow page loads. Expensive to change later: running a second machine or zero-downtime deploys both require moving files off the volume first; splitting out a worker means extracting the job loop. The service layer keeps request handling and jobs separate in code so that split stays possible.
