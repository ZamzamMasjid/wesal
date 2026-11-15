---
id: ADR-015
type: adr
title: Back up the database with Fly volume snapshots only
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/deployment
mirror_id: ""
counterpart_adrs: []
---

# ADR-015: Back up the database with Fly volume snapshots only

## Context

The database is self-run on a Fly volume (ADR-002), so backups are the developer's responsibility.

## Decision

Rely on Fly's automatic daily volume snapshots. No separate dump job.

## Rationale

Nothing to build or operate, and it matches how the user's other project is backed up.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Snapshots plus a nightly dump stored off Fly | Would survive a lost volume or a Fly account problem, at the price of one more scheduled job and a storage bucket. |
| Nightly dump to the app machine's volume | Protects against a damaged database machine, not against losing Fly or that volume. |

## Consequences

Up to a day of bookings can be lost if the database volume fails, and recovery depends entirely on Fly. Restoring from a snapshot should be rehearsed once during deployment so the procedure is known before it is needed.
