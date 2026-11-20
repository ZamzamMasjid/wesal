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


## [2026-11-16] — Message delivery

- **Type**: Feature Change
- **Summary**: Message delivery is built: a messaging adapter with a Twilio implementation (plain HTTP), a log-only sender for development and the recording fake for tests; an `outbox_message` table written in the caller's transaction; an in-process job loop (isolated, time-limited runs, tick heartbeat, watchdog exit) that sends due messages with retry and backoff; `POST /api/v1/webhooks/twilio/status` with signature check, which sends an undelivered WhatsApp message again by SMS; and bilingual `code`, `booking-link` and `staff-alert` templates. The open question on attempts and backoff is settled: five attempts per channel at 30 s, 2 min, 10 min and 30 min, then SMS, then failed. Providers are chosen by `MESSAGING_PROVIDER`; without `twilio` nothing is sent.
- **Affected Docs**: message-delivery, ADR-030, phase-2-foundations
- **Reason**: Implementing `phase-2-foundations/message-delivery`.

## [2026-11-17] — Fee-free WhatsApp provider

- **Type**: Feature Change
- **Summary**: Added a second messaging provider, `MESSAGING_PROVIDER=whatsend`, that sends WhatsApp through the WhatSend worker (a QR-linked device) at no per-message fee. It is WhatsApp-only: SMS fails instead of falling back to a paid channel.
- **Affected Docs**: message-delivery, ADR-031
- **Reason**: Avoid messaging costs until volume justifies Twilio.

## [2026-11-17] — Phone verification

- **Type**: Feature Change
- **Summary**: Phone verification is built: `POST /api/v1/verification/request` stores a hashed six-digit code and sends it inline (not through the outbox), and `POST /api/v1/verification/check` compares it in constant time and returns a ten-minute verified-phone token signed for that phone. Requests are limited to one per phone per 60 seconds, five per phone per hour and twenty per IP per hour (`RATE_LIMITED`); codes live five minutes and allow five attempts (`CODE_EXPIRED`, `TOO_MANY_ATTEMPTS`). When neither WhatsApp nor SMS delivers, the request fails with `CODE_DELIVERY_FAILED` carrying the venue's phone and WhatsApp contact and no hold is created. The open question is settled at five minutes, five attempts and 60 seconds. The code-entry step (six boxes, auto-submit, resend timer, delivery-failure panel) is in place in Arabic and English, ready for `booking-hold` to mount.
- **Affected Docs**: phone-verification, phase-2-foundations
- **Reason**: Implementing `phase-2-foundations/phone-verification`.

## [2026-11-18] — Public calendar

- **Type**: Feature Change
- **Summary**: The public calendar is built. `GET /api/v1/availability` returns every day in a range with its closed flag and each slot's state (free, awaiting payment, awaiting review, confirmed), computed at request time — a held slot whose deadline has passed reads free even before the sweep marks it. Each free slot carries a server-computed action: `book`, `call` inside the near-slot cutoff, or `none` once past or started. The bilingual page at `/[locale]/calendar` shows the month with a free-versus-full marker per day, the selected day's slots with state badges, the legend and the call/WhatsApp fallback; it refreshes every 30 seconds while visible and on focus, keeping the previous states so nothing flashes empty. The month shows no count of free slots (the open question is settled). The `booking` table is introduced as availability's read dependency, with no exclusion constraint yet — `booking-hold` adds it.
- **Affected Docs**: public-calendar, calendar (view), phase-3-booking
- **Reason**: Implementing `phase-3-booking/public-calendar`.

## [2026-11-20] — Booking hold

- **Type**: Feature Change
- **Summary**: The slot hold is built. `POST /api/v1/bookings` takes the day, slot start and end, occasion, name, phone, verified-phone token and locale, and in one transaction expires the caller's overdue holds, refuses a second live hold from the same phone (`PHONE_HOLD_EXISTS`), re-checks the slot against the schedule, refuses a closed, missing, started or near-slot slot (`SLOT_UNAVAILABLE`), writes the held booking with the quoted price and 50% deposit, and queues the `booking-link` message. Two customers racing for one slot yield exactly one hold and one `SLOT_TAKEN`, backed by a database exclusion constraint over the active time ranges of held, proof-submitted and confirmed bookings (migration 0009). The deadline is the earlier of 20 minutes and the 2-hour near-slot cutoff; a slot inside 24 hours is flagged urgent. The `holds` job marks overdue holds expired, though expiry is by timestamp for every read and write. The booking form at `/[locale]/book` shows the slot, occasion radio cards with prices, the deposit for the chosen occasion, name and phone with inline errors, the what-happens-next list and a change-slot link; it mounts the existing verification step, then shows the booking ID, deadline, deposit and a link to the private booking page, or the conflict panel when the slot is taken. A visitor reaching the form for a slot that is not bookable is sent back to the calendar with that day open.
- **Affected Docs**: booking-hold, booking-form (view), phase-3-booking
- **Reason**: Implementing `phase-3-booking/booking-hold`.

## [2026-11-20] — Booking page

- **Type**: Feature Change
- **Summary**: The private booking page is built. `GET /api/v1/bookings/by-token/{token}` returns one booking as its holder may see it — occasion, day and slot, name, price, deposit and remainder, and the booking ID — never the phone number. A `held` row past its deadline reads expired without waiting for the sweep (ADR-010), and the transfer details appear only while the booking is still payable. `GET /api/v1/bookings/lookup?bookingId=` turns a typed ID into the page's token; it normalizes case, spaces, hyphens and Arabic-Indic digits, is limited to ten tries a minute per address, and answers a malformed ID exactly like an unknown one. The page at `/[locale]/booking/{token}` shows the status badge and what to do now, the deposit and copyable Vodafone Cash and InstaPay details, a countdown measured from the server's deadline and `refreshedAt` rather than the page load, the booking summary with a copyable ID, a framed confirmation card with the balance due at the venue, and Book again on expired, rejected or cancelled bookings. It refreshes every 30 seconds while visible and on focus, keeps the last known status with a "not live" note and Retry when a refresh fails, switches to expired at zero without a reload, announces a status change assertively, and announces the countdown each minute then every second of the last ten. `/[locale]/find-booking` and the empty state of the page carry the find-my-booking form. The booking ID format is settled at six characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The proof upload arrives with `payment-proof`.
- **Affected Docs**: booking-page, booking-status (view), phase-3-booking
- **Reason**: Implementing `phase-3-booking/booking-page`.

