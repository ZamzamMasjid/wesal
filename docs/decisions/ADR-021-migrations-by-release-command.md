---
id: ADR-021
type: adr
title: Run migrations as the Fly release command
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/deployment
mirror_id: ""
counterpart_adrs: []
---

# ADR-021: Run migrations as the Fly release command

## Context

The schema is managed with Drizzle migrations (ADR-003) against a self-run Postgres machine (ADR-002). Nothing stated how a schema change reaches the production database, or what happens to the site when a migration fails.

## Decision

Pending migrations are applied by Fly's release command: a temporary machine built from the new image runs them before the app machine is replaced. A failed migration aborts the deploy.

## Rationale

A failed migration leaves the old version serving instead of taking the site down, and migrating can never be forgotten because it is part of every deploy.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Migrate when the app boots | Nothing extra to configure, but a failed migration becomes a crash loop with the site down, and every start pays the check. |
| Manual step over a Fly proxy before deploying | Full control over timing and nothing automatic to go wrong, but it is a step to remember, and a deploy can ship against a schema that was never migrated. |

## Consequences

For a moment the old code runs against the new schema, so a migration must not break the version it replaces: additive changes go in one deploy and removals in a later one. The release machine has no volume, so a migration can never read or move files on `upload-volume`. The release machine needs the database URL secret and private-network access to the database machine.
