---
id: ADR-002
type: adr
title: Use PostgreSQL, self-run on a Fly machine
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/database
mirror_id: ""
counterpart_adrs: []
---

# ADR-002: Use PostgreSQL, self-run on a Fly machine

## Context

The core promise is that no slot ever has two active bookings, including when two people submit in the same instant and when staff enter a booking by hand. That guarantee has to hold in the database, not only in application code. The database also has to be hosted somewhere a solo developer on a small budget can run it.

## Decision

Use PostgreSQL. Run it as a self-managed Postgres machine on Fly.io with its own volume.

## Rationale

PostgreSQL can reject overlapping active bookings with an exclusion constraint over time ranges and supports the transactions and row locks hold creation needs. Self-running it on Fly keeps everything on one platform and one private network at the lowest monthly cost, which the user chose over managed options.

## Alternatives considered

| Alternative | Why not |
|---|---|
| MySQL or MariaDB | No partial or exclusion constraints, so the one-active-booking rule would need a workaround. |
| SQLite | Weaker for concurrent writes and awkward for the constraint this product depends on. |
| Neon (external managed Postgres) | Was the recommendation for its automatic backups; the user preferred to keep the database on Fly. |
| Fly Managed Postgres | Backups handled, but the most expensive option per month. |

## Consequences

Backups, upgrades and recovery are the developer's responsibility (see ADR-015). The exclusion constraint needs the btree_gist extension. The app and database talk over Fly's private network.
