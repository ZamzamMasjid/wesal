---
id: ADR-007
type: adr
title: Deploy on Fly.io
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/deployment
mirror_id: ""
counterpart_adrs: []
---

# ADR-007: Deploy on Fly.io

## Context

The app needs an always-on process for timed jobs, a database and file storage, run by one developer at low cost.

## Decision

Deploy on Fly.io with a Docker build in the ams region, mirroring the user's existing project: one app machine with a volume, plus the database machine.

## Rationale

The user already runs a project this way and asked for the same setup. An always-on machine suits the in-process job loop.

## Alternatives considered

| Alternative | Why not |
|---|---|
| One VPS with Docker Compose | Was the recommendation for predictable cost; the user preferred the platform he already uses. |
| Vercel plus managed Postgres | No server to manage, but timers and background jobs need an add-on. |

## Consequences

Auto-stop must be off so the job loop keeps running. Secrets are Fly secrets. Visitors in Egypt are served from Amsterdam.
