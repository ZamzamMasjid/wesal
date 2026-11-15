---
id: ADR-019
type: adr
title: Use Playwright for end-to-end tests
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/testing
mirror_id: ""
counterpart_adrs: []
---

# ADR-019: Use Playwright for end-to-end tests

## Context

Two journeys must work in a real browser in both languages and directions: a customer going from the landing page to an uploaded proof, and staff reviewing and deciding.

## Decision

Use Playwright for end-to-end tests, kept to about a tenth of the test effort.

## Rationale

It runs Chromium, Firefox and WebKit, emulates phones, handles multiple browser contexts (customer and staff in one test) and captures screenshots for right-to-left checks.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Cypress | Friendly runner, weaker multi-browser and multi-context support. |
| No end-to-end tests | Would leave the two journeys and the RTL layout checked only by hand. |

## Consequences

A smoke test runs on every pull request; the full journeys are added when their sections ship. Playwright retries once in CI and reports flakes.
