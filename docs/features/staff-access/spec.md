---
id: staff-access
type: feature
title: Staff Access
status: planned
last_modified: 2026-11-15
milestone: v1
pillar: back-office
depends_on: []
views: []
adrs: [ADR-004, ADR-012, ADR-018, ADR-020]
roadmap_sections: [phase-2-foundations/staff-access]
architecture: [auth, data-model, testing]
components: [web, postgres]
---

# Staff Access

## Purpose

Controls who can enter the dashboard and what they can do there. The owner has full control; a few staff members can handle bookings and payments but cannot change anything that defines the business: prices, slots, payment numbers or site content. Every action staff take is recorded.

## Behavior

Owner and staff log in to the dashboard with a login and password. There is no public sign-up: the owner creates each staff account, can disable it, and can reset its password.

| Action | Staff | Owner |
|---|---|---|
| Review, confirm, reject payments; mark proof received | Yes | Yes |
| Enter phone and walk-in bookings; cancel; mark remainder paid | Yes | Yes |
| View all bookings and screenshots | Yes | Yes |
| Change prices, occasions, deposit, payment details | No | Yes |
| Change slots, exceptions, blocked dates | No | Yes |
| Change site content and media | No | Yes |
| Manage staff accounts | No | Yes |

The dashboard only shows a staff member what they are allowed to use; the server enforces the same rules regardless of what the screen shows. Every staff action that changes a booking or a setting is written to an audit log with who did it and when.

## Data

- **Staff user** — name, login, role (owner or staff), notification phone, active flag.
- **Session** — managed by Better Auth.
- **Audit log** — actor, action, booking or setting affected, time, detail. Append-only.

## Surface

- `/api/auth/*` — Better Auth login, logout and session routes.
- `GET /api/v1/staff/me` — current user and role.
- `GET /api/v1/staff/users`, `POST /api/v1/staff/users`, `PATCH /api/v1/staff/users/{id}` — owner only.
- `GET /api/v1/staff/audit?bookingId=` — audit entries, owner only.
- `/dashboard/login`, `/dashboard` — login screen and dashboard shell.

## Workflows

**Adding a staff member.**

1. Owner opens Staff, enters a name and login, and sets an initial password.
2. Gives the credentials to the staff member, who logs in and is asked to change the password.

**Removing access.**

1. Owner disables the account; any open session of that user stops working at once.

## Edge cases and constraints

- There is always at least one active owner; the last owner cannot be disabled or demoted.
- Repeated failed logins are rate-limited.
- Sessions are HTTP-only, secure cookies; a missing or invalid session always denies.
- Opening a link from a staff alert while logged out leads to login and then on to the linked booking.
- The dashboard is fully bilingual and usable on a phone, since the owner confirms payments from one.
- Audit rows are never edited or deleted.

## Open questions

- Is the login an email, a phone number or a plain username? The interview left "email or phone + password" open.
- Is a forgotten-password flow needed in v1, or is an owner reset enough?
