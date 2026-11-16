# Changelog

History of behavior changes — new features, modified contracts, design changes, removed capabilities.

Implementation details (refactors, dependency bumps, internal cleanups) belong in git history, not here.

---

## [2026-11-15] — Project Created

- **Type**: Initial scaffold
- **Summary**: Project bootstrapped via `axiom:bootstrap`. See `docs/_meta/vision-brief.md` for the original vision.
- **Affected Docs**: PRD, INDEX, all initial features, architecture docs, design system + patterns + views, roadmap phases, initial ADRs
- **Reason**: Project inception

## [2026-11-15] — Architecture overview deepened

- **Type**: Design Change
- **Summary**: Server-rendered pages call operation functions in-process and authorization moves into the operation; migrations run as the Fly release command; job runs are isolated and a stalled job loop restarts the process; production is the only deployed environment. The overview gains a deployment section, a health contract and four failure rows.
- **Affected Docs**: overview, ADR-020, ADR-021, ADR-022, ADR-023, landing-page, staff-access, booking-hold, message-delivery, payment-proof
- **Reason**: `axiom:architect overview` closed four structural gaps the foundation pass left open.

## [2026-11-15] — Visual language established

- **Type**: Design Change
- **Summary**: `axiom:design` set the visual language: warm sand and paper neutrals with an oxblood brand and an olive secondary, large radii, pill controls, shadows in place of borders, and Cairo as the only type family. This replaces the proposed green and gold direction with serif headings and geometric ornament. Slot-state colors changed with the palette. The landing page hero is now the photograph alone; the venue name moves below it and "Check availability" moves under the price cards. Tokens reach the app as CSS variables.
- **Affected Docs**: design-system, home, calendar, landing-page (design), ADR-024
- **Reason**: The owner chose the "Waraq" direction from three candidates, asked for Cairo throughout and for the hero card to be removed, and approved the home and calendar mockups.

## [2026-11-16] — Staff login by username

- **Type**: Feature Change
- **Summary**: Staff-access begins: owner and staff log in to the dashboard with a username and password through Better Auth. The open question on the login identifier is settled as a username; there is no sign-up, accounts are created only by the owner's tooling, and a disabled account stops working at once. Staff tables are reshaped for Better Auth (text ids, `username` replaces `login`).
- **Affected Docs**: staff-access, data-model, ADR-004, ADR-026, ADR-029, phase-2-foundations
- **Reason**: First item of the staff-access section; the spec left the login identifier open.
- **Also**: an `owner:create` script creates the first owner on a fresh database (refuses once an active owner exists), so production has a way in without a sign-up route.

## [2026-11-16] — Staff access: roles, dashboard, accounts, audit log

- **Type**: Feature Change
- **Summary**: The dashboard exists: a bilingual login screen and a shell (side navigation on desktop, bottom tab bar on phones) that shows each role only what it may use. The owner can list, create, disable, enable and reset the password of staff accounts; disabling or resetting ends that user's open sessions at once, and the last active owner cannot be disabled or demoted. Staff actions are recorded in an append-only audit log, enforced by a database trigger. `GET /api/v1/staff/me`, `/staff/users`, `PATCH /staff/users/{id}` and `/staff/audit` are live, owner-only where the spec says so, and one table-driven test proves every registered owner-only operation refuses staff and anonymous callers.
- **Affected Docs**: staff-access, data-model, phase-2-foundations
- **Reason**: Remaining items of the staff-access section.
- **Also**: new error codes `USERNAME_TAKEN` and `LAST_OWNER`. A staff member is not made to change the initial password on first login (decided; removed from the spec). Opening a dashboard link while logged out now continues to that link after login.


## [2026-11-16] — Venue settings defaults

- **Type**: Clarification
- **Summary**: Venue settings are built: owner-only occasion and settings APIs and a bilingual settings screen. Defaults were chosen for the open question: hold 20 minutes, near-slot cutoff 120 minutes, urgent threshold 1440 minutes, deposit 50%. The settings row is created on first read. The caution about changing payment details while holds are active is always shown until bookings exist.
- **Affected Docs**: venue-settings
- **Reason**: Implementing `phase-2-foundations/venue-settings`.

## [2026-11-16] — Venue settings design aligned to the shipped page

- **Type**: Design Change
- **Summary**: The venue settings design now describes the shipped single-page layout: three sections instead of tabs, per-occasion Save, one Save for deposit, rules and payment, a Deactivate/Activate button instead of a toggle, and a localized notice for validation errors. Occasion reordering, the live deposit example, the unsaved-changes warning and the old-to-new price toast are dropped from v1.
- **Affected Docs**: venue-settings (design)
- **Reason**: `axiom:ui-check` found the shipped UI differed from the design in these places; the owner chose to align the docs to the code.

## [2026-11-16] — Slot schedule

- **Type**: Feature Change
- **Summary**: The slot schedule is built: an owner-only weekly pattern and date exceptions (custom slots or closed) with overlap validation, a slot resolver that computes a date's slots from the pattern plus exceptions, and a bilingual schedule editor (weekly grid, exceptions list, block a date, copy a day, conflict panel). `GET/PUT /api/v1/staff/schedule/pattern`, `GET /staff/schedule/exceptions` and `PUT/DELETE /staff/schedule/exceptions/{date}` are live and audited. Edits are refused with the new `SCHEDULE_CONFLICT` code when an active booking would lose its slot; until the booking table exists (phase 3) the guard has no bookings to find, and `booking-hold` supplies the query. Exceptions cannot be set on past dates.
- **Affected Docs**: slot-schedule, schedule-editor (view), phase-2-foundations
- **Reason**: Implementing `phase-2-foundations/slot-schedule`.

