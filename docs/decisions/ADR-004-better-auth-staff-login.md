---
id: ADR-004
type: adr
title: Use Better Auth for staff login
last_modified: 2026-11-16
decision_status: Accepted
phase_section: phase-2-foundations/staff-access
mirror_id: ""
counterpart_adrs: []
---

# ADR-004: Use Better Auth for staff login

## Context

Only the owner and a few staff log in. Customers never have accounts. There are two roles with different rights, and every staff action must be attributable for the audit trail.

## Decision

Use Better Auth with password login, storing users, sessions and roles in the project's own PostgreSQL database.

## Rationale

It keeps identity data in the same database as everything else, needs no outside service, and supports roles and session management without hand-writing security-sensitive code.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Auth.js (NextAuth) | Password login is its least polished path. |
| Hand-written sessions | Fewest dependencies, but more security-sensitive code for one developer to own. |

## Consequences

Staff accounts are created by the owner; there is no public sign-up. The login identifier is a username (ADR-029). Sessions are checked against the database on every staff request.
