---
id: ADR-012
type: adr
title: Expose a versioned JSON API from day one, used by the web UI
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/project-setup
mirror_id: ""
counterpart_adrs: []
---

# ADR-012: Expose a versioned JSON API from day one, used by the web UI

## Context

A mobile app follows the web app. The question was whether the web UI should call server logic directly now, with an API added when mobile starts, or use a real API from the beginning.

## Decision

Every operation is a versioned JSON endpoint under /api/v1. The web UI calls the same endpoints the mobile app later will.

## Rationale

The user chose this so the mobile app is unblocked from the start and the API is exercised by a real client from the first day.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Shared service layer with server actions now, API added with mobile | Less to build now, but the mobile app would wait for an API that had never been used. |

## Consequences

More code up front: validation, a typed error envelope and stable error codes for every operation. Authorization lives at the API and nowhere else. Once the mobile app ships, incompatible changes need a new version. Integration tests target the endpoints, which doubles as contract coverage.
