---
id: ADR-014
type: adr
title: Keep the public calendar fresh by polling every 30 seconds
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-3-booking/public-calendar
mirror_id: ""
counterpart_adrs: []
---

# ADR-014: Keep the public calendar fresh by polling every 30 seconds

## Context

Slot states change while visitors are looking at the calendar. The app machine is small and holds no connection per visitor.

## Decision

The calendar re-fetches slot states about every 30 seconds and when the page regains focus.

## Rationale

Simple and cheap. Staleness is harmless because the server refuses a double hold regardless and tells the visitor why.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Live push updates | Updates within a second, but an open connection per visitor on a 256 MB machine and another moving part. |
| Only on page load | Simplest, but states stay stale until the visitor reloads. |

## Consequences

A visitor may briefly see a slot as free that was just taken and then get the slot-conflict message. The availability endpoint must be cheap and may be cached for a few seconds. The booking page and review queue use the same polling approach.
