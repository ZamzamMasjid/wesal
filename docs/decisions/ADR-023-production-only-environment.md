---
id: ADR-023
type: adr
title: Production is the only deployed environment
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/deployment
mirror_id: ""
counterpart_adrs: []
---

# ADR-023: Production is the only deployed environment

## Context

One developer builds and operates the system at small scale and low cost. The question was whether anything should sit between the developer's machine and production.

## Decision

There are two environments: local development (docker-compose Postgres, fake message sender, with CI running the same tests) and production on Fly. There is no staging.

## Rationale

Nothing extra to pay for, secure or keep in sync, which the user chose over rehearsing deploys on real infrastructure.

## Alternatives considered

| Alternative | Why not |
|---|---|
| On-demand staging: a second small Fly app and database, started when needed | Deploys, migrations and the Twilio webhook could be rehearsed on real infrastructure for little cost, but it is a second set of secrets and volumes to maintain. |
| Permanent staging | Every change rehearsed and the owner could preview, at roughly double the running cost and operating work. |

## Consequences

The first time a deploy, a migration or the Twilio status webhook runs on Fly, it runs in production. The release command (ADR-021) is the only guard between a bad migration and the live database, and the snapshot restore rehearsal (ADR-015) happens on the production setup. Adding staging later is cheap: a second Fly app from the same image and configuration.
