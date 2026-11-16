---
id: ADR-029
type: adr
title: Staff log in with a username; Better Auth's email field holds a placeholder
last_modified: 2026-11-16
decision_status: Accepted
phase_section: phase-2-foundations/staff-access
mirror_id: ""
counterpart_adrs: []
---

# ADR-029: Staff log in with a username; Better Auth's email field holds a placeholder

## Context

ADR-004 chose Better Auth for staff login and left open whether the login is an email, a phone number or a username. Better Auth identifies a user by email and requires one on every user row. Only the owner and a few staff log in, the owner creates each account, and there is no sign-up and no email flow in v1.

## Decision

Staff log in with a username and password, using Better Auth's username plugin. The `staff_user.email` column holds a placeholder, `<username>@staff.wesal.invalid`, on a reserved domain that cannot receive mail. The username is stored lowercase and is unique. Accounts are created only by `createStaffAccount`, which writes the user and its hashed password credential through Better Auth's internal adapter; email sign-up is disabled. A disabled account is `active = false`, the session check reads it on every request, and it cannot start a session. The user table is Better Auth's own, named `staff_user`, with `role`, `active` and `notifyPhone` as additional fields.

## Rationale

A username needs no mailbox, which suits a few staff who may not have a work address, and it matches the login the seed already used. The placeholder keeps Better Auth's required field satisfied without storing a made-up real address or sending mail anywhere.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Email login | Needs every staff member to have a reachable address; only worthwhile if a forgot-password email flow is wanted, which the spec defers to an owner reset. |
| Phone login | Needs the phone plugin and number normalisation for no gain over a username. |
| Better Auth's admin plugin for roles and disabling | Brings its own role and permission model for two fixed roles; a plain `role` field and `active` flag are simpler to authorize against in one guard. |

## Consequences

If a forgot-password email flow is added later, real email addresses must be collected and the placeholder replaced. The owner resets passwords for now. The old `login` and integer `id` columns are gone: ids are text, assigned by Better Auth. Rate limiting is Better Auth's in-memory limiter, five login attempts a minute per client, which is per process and fine for one machine.
