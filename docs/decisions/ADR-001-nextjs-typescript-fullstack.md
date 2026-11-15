---
id: ADR-001
type: adr
title: Use Next.js and TypeScript as a full-stack framework
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/project-setup
mirror_id: ""
counterpart_adrs: []
---

# ADR-001: Use Next.js and TypeScript as a full-stack framework

## Context

Wesal needs a public, search-friendly landing page, an interactive booking flow, a staff dashboard and server logic, built and run by one developer. Arabic with right-to-left layout is the default, English is fully supported. A mobile app follows later.

## Decision

Build the whole web app on Next.js with TypeScript: server-rendered public pages, the dashboard, and route handlers for the JSON API in one codebase. Style with Tailwind CSS.

## Rationale

One codebase and one deployable suits a solo developer. Server rendering gives a fast landing page on slow phones and makes it indexable. TypeScript is shared with the Expo stack the developer already uses, so types and validation schemas can be shared with the later mobile app. Tailwind was assumed from the developer's existing web project and its logical properties make one stylesheet serve both directions.

## Alternatives considered

| Alternative | Why not |
|---|---|
| React SPA plus a NestJS API | Two things to build, deploy and keep in sync from day one, for one developer. |
| Laravel (PHP) | Mature and cheap to host, but a different language from the planned React Native mobile app and from the developer's current projects. |

## Consequences

Pages, API and background jobs share one process and one deploy (see ADR-009). The framework's conventions shape the folder layout. Tailwind was not put to the user as a question; it is recorded here as an assumption that can be revisited before project setup.
