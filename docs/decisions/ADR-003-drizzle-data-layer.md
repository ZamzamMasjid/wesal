---
id: ADR-003
type: adr
title: Use Drizzle as the data layer
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/database
mirror_id: ""
counterpart_adrs: []
---

# ADR-003: Use Drizzle as the data layer

## Context

The data layer must express an exclusion constraint, transactions and row locks without fighting the tool, and give typed queries in TypeScript.

## Decision

Use Drizzle ORM with its migration tooling.

## Rationale

Drizzle is thin and SQL-shaped, so the queries that matter here (expire the overdue hold, then insert, in one transaction) read like the SQL they are. Constraints it cannot declare in its schema are written as plain SQL in a migration alongside it.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Prisma | Friendlier schema and tooling, but partial and exclusion constraints and row locking need hand-written SQL outside its model. |
| Raw SQL with Kysely | Full control, but more hand work for ordinary screens and hand-written migrations. |

## Consequences

The exclusion constraint lives in a raw SQL migration and must be covered by an integration test so it cannot be dropped unnoticed. Schema types are generated from the Drizzle schema and shared with the API validation.
