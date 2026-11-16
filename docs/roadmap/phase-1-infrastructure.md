---
id: phase-1-infrastructure
type: roadmap-phase
title: Phase 1 — Infrastructure
status: in-progress
last_modified: 2026-11-15
milestone: v1
phase_number: 1
sections: [project-setup, database, testing, deployment]
infrastructure_sections: [project-setup, database, testing, deployment]
---

# Phase 1 — Infrastructure

## Goal

Stand up the application skeleton, the database, the test tooling and the production environment, so every later section has somewhere to land and a pipeline that checks it. Builds the three components defined in the architecture overview: web, postgres and upload-volume.

## Prerequisites

None. A Fly.io account and a GitHub repository are needed for the deployment and testing sections.

## Sections

### project-setup

The Next.js application skeleton that every later section builds on. Builds the `web` component: TypeScript, Tailwind, shadcn/ui, bilingual routing with RTL, and the JSON API conventions.

- [x] Scaffold Next.js App Router project with strict TypeScript, ESLint and Prettier
- [x] c
- [x] Add locale routing: Arabic default (RTL) and English, with message catalogs
- [x] Add `/api/v1` conventions: zod validation, typed error envelope, error codes
- [x] Add structured logger and injectable clock used by all services
- [x] Add light/dark theme toggle wired to design tokens

### database

The data layer. Builds the `postgres` component for local development and test, with Drizzle migrations.

- [ ] Add docker-compose Postgres for local development and tests
- [ ] Configure Drizzle with migrations and a typed database client
- [ ] Enable the btree_gist extension in the first migration
- [ ] Add dev seed script: owner account, sample occasions, weekly slot pattern

### testing

The test tooling and CI gates decided in the testing strategy.

- [ ] Install Vitest + v8 coverage; add `test` and `coverage` scripts
- [ ] Configure Vitest projects: unit, and integration against real Postgres with per-test isolation
- [ ] Add test scaffold under src/test: factories, database helper, fake clock, fake sender
- [ ] Install Playwright; write smoke test loading the home page in Arabic and English
- [ ] Wire GitHub Actions to run lint, typecheck and tests on every PR; block on failure
- [ ] Enforce 80% line / 70% branch coverage in CI; block on drop
- [ ] Add CONTRIBUTING note pointing to docs/architecture/testing.md as the source of truth

### deployment

Production on Fly.io. Builds the production `postgres` machine and the `upload-volume` component, and ships `web`.

- [ ] Write Dockerfile and fly.toml for the app (ams region, always on, no auto-stop)
- [ ] Provision self-run Postgres machine with a volume and daily snapshots
- [ ] Create and mount the upload volume at /data with media and proofs directories
- [ ] Set Fly secrets (database URL, auth secret, Twilio) and document the deploy steps
- [ ] Add health endpoint and static fallback notice with venue phone and WhatsApp
