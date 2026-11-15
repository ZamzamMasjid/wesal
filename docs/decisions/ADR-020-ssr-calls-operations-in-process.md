---
id: ADR-020
type: adr
title: Server-rendered pages call operations in-process
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/project-setup
mirror_id: ""
counterpart_adrs: []
---

# ADR-020: Server-rendered pages call operations in-process

## Context

ADR-012 made every operation a versioned JSON endpoint that the web UI uses. The landing page and the dashboard are rendered on the server, and the architecture overview said pages "call the JSON API like any other client" without saying how a page rendering inside the server reaches an endpoint served by the same process. The app machine is small (256 MB class).

## Decision

Each endpoint is a thin HTTP wrapper around one operation function that validates its input, authorizes the caller and calls the service layer. Server-rendered pages call that operation function directly, in-process. Code running in the browser, and later the mobile app, calls the endpoint over HTTP.

## Rationale

It keeps one path through validation and authorization for every caller while avoiding a second HTTP request, a JSON round trip and cookie forwarding on every page render on a small machine.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Loopback HTTP: the server fetches its own `/api/v1` | The API would be exercised end to end on every render and there would be literally one way in, but each render costs an extra request and serialization and must forward the caller's cookies. |
| Browser fetch only: pages render a shell and the browser loads the data | The simplest boundary, but the landing page must be server-rendered for slow phones and search engines, so it could only cover the dashboard and a second mechanism would still be needed. |

## Consequences

Authorization must live in the operation function, never in the HTTP wrapper, or a server render would bypass it. Routing, status codes and serialization are exercised only by browser calls and by the integration tests that target the endpoints, so every operation still needs its endpoint test even when its only v1 caller is a page. An operation's inputs and results must stay serializable so the endpoint and the in-process call cannot drift apart.
