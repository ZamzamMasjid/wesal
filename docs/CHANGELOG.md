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

## [2026-11-21] — Architecture review: the WhatSend provider and four review findings

- **Type**: Design Change
- **Summary**: The architecture now describes both messaging providers. The overview's context and component diagrams, contracts table, secrets, deployment section and failure table include the WhatSend worker as an external Fly app with its own volume (`ADR-031`); Twilio remains the only provider with an SMS fallback and delivery callbacks. `flows` and `auth` carry the same provider split in their failure tables, and flow 5 shows the no-SMS branch. The health endpoint reports the worker's session state in WhatSend mode without failing the check. Channel capability is now stated as the provider's, so no spec promises an SMS fallback under a WhatsApp-only provider. Proof upload is allowed while held or awaiting review, and the one-day purge skips files whose booking still awaits review (`ADR-005`). The booking page joins the calendar in the 30-second polling window, and `ADR-031` gains its alternatives table.
- **Affected Docs**: overview, auth, flows, data-model, ADR-005, ADR-031, message-delivery, phone-verification, staff-notifications, payment-proof, booking-hold, booking-page, slot-alerts, venue-settings
- **Reason**: `axiom:architect --review` found the provider decision and the failure plan out of step with the shipped WhatSend adapter, plus a stale proof-upload rule, a phantom payment-details endpoint and an unrecorded purge rule. The owner settled re-upload and purge in review.

## [2026-11-21] — Health reports the WhatsApp session

- **Type**: Feature Change
- **Summary**: The full health response gains `messaging`: `{"provider":"twilio"}` or `{"provider":"none"}` outside WhatSend mode, and `{"provider":"whatsend","session":"linked"|"unlinked"|"unknown"}` in it. The probe asks the worker's session status with the bearer secret and a two-second timeout, never throws, and logs one warning when the session stops being linked rather than on every check. `?probe=web` skips both the database and the messaging probe, so Fly's deploy check never waits on the worker and a database outage does not restart the machine.
- **Affected Docs**: overview, ADR-031, DEPLOYMENT.md
- **Reason**: Implements the health contract recorded by the architecture review, so a dropped WhatsApp link is visible before a customer reports it.

## [2026-11-21] — Payment proof

- **Type**: Feature Change
- **Summary**: Payment proof is built. `POST /api/v1/bookings/by-token/{token}/proof` takes one multipart image, checks its first bytes (JPEG, PNG or WebP, up to 10 MB) rather than its name, writes it under `UPLOAD_DIR/proofs`, and in one transaction records a `payment_proof` row and moves the booking from `held` to `proof_submitted` with no deadline left. A hold past its deadline is stamped expired and refused with `HOLD_EXPIRED`; a confirmed, rejected or cancelled booking is refused the same way; a second upload while awaiting review adds another proof; an unwritable volume answers `SERVICE_UNAVAILABLE` and leaves the booking held. `GET /api/v1/staff/proofs/{id}/file` serves the image to a logged-in staff session only, with `private, no-store` and `nosniff`, and answers "no longer available" for a purged or lost file. The booking page gains the upload area: it previews the chosen image, reports upload progress, keeps the area visible while awaiting review, maps every error code to one next step, and offers a WhatsApp button prefilled with the booking ID. The `proof-purge` job deletes proof files older than a day whose booking is no longer awaiting review, stamps `purged_at`, keeps the row for the audit trail, and retries a file it could not delete on the next daily run.
- **Affected Docs**: payment-proof, booking-status (view), phase-3-booking
- **Reason**: Implementing `phase-3-booking/payment-proof`. Staff alerts on a new proof remain with `phase-4-operations/staff-notifications`.

## [2026-11-21] — Payment review

- **Type**: Feature Change
- **Summary**: Payment review is built. `GET /api/v1/staff/review-queue` lists bookings awaiting review oldest first with urgent ones pinned on top, alongside urgent live holds, together with the newest proof and how long each has waited. `GET /api/v1/staff/review-queue/{bookingId}` returns one booking with its proofs newest first. Confirm, reject (with a reason and optional note) and mark-proof-received each run in one transaction with a row lock and an append-only audit row; a second staff decision is refused with `BOOKING_STATUS_CHANGED` and the current status. Rejecting frees the slot at once. A WhatsApp proof is recorded without a file, stops the countdown, and may be confirmed in the same step. The dashboard gains `/dashboard/review` and `/dashboard/review/{bookingId}`: urgent-first queue refreshed on focus and every 30 seconds, a live Review badge, deposit-first review page, staff-only screenshot viewer, confirm and reject dialogs, and the mark-proof-received panel for held bookings. A staff alert link survives login because the existing `next` redirect handles it.
- **Affected Docs**: payment-review, review-queue (view), phase-4-operations
- **Reason**: Implementing `phase-4-operations/payment-review`.

## [2026-11-21] — Staff notifications

- **Type**: Feature Change
- **Summary**: Staff alerts are built. A proof upload queues a `staff-alert` outbox message in the same transaction, one per recipient, carrying the occasion, slot, customer name, deposit and a link to that booking's review page; a hold on a slot inside the urgent threshold queues the urgent variant at creation. The text never carries the screenshot or phone number (ADR-013), and the outbox retries it with the usual backoff. `staff_user` gains `notify_enabled` (default on) and `locale` (default Arabic) through migration 0011. Active staff with a phone who opted in receive alerts in their own language; when nobody opted in, the owner's phone is used anyway, and an alert with no phone anywhere is logged rather than lost. `PATCH /api/v1/staff/me/notifications` sets the caller's phone, opt-in and alert language with an audit row; `PATCH /api/v1/staff/users/{id}` now accepts the same opt-in for the owner. The dashboard home gains a "My alerts" card for every staff member, and the staff screen shows each account's alert phone and state with an edit dialog.
- **Affected Docs**: staff-notifications, data-model, phase-4-operations
- **Reason**: Implementing `phase-4-operations/staff-notifications`.

## [2026-11-21] - Booking management

- **Type**: Feature Change
- **Summary**: Booking management is built. Staff see every booking at `/dashboard/bookings`, filtered by date range, status, source and a search over name, phone or booking ID, with 25 per page and the filters kept in the URL; an overdue hold reads as expired in both the list and its filter (ADR-010). Opening a booking shows its proofs and a merged history of customer events (created, proof uploaded) and staff actions from the audit trail. `POST /api/v1/staff/bookings` enters a phone or walk-in booking: it validates the offered slot and occasion, starts the booking confirmed with the current price and no recorded deposit, runs the same exclusion constraint as a customer hold (an active hold wins with `SLOT_TAKEN` and answers with the holder, its status and deadline), and queues a `booking-confirmed` message carrying the customer's booking-page link. `POST /api/v1/staff/bookings/{id}/cancel` cancels only a confirmed booking, requires a reason, frees the slot and records it; `POST /api/v1/staff/bookings/{id}/remainder-paid` marks the flag idempotently. Every entry, cancellation and remainder mark writes an append-only audit row in its transaction. The bookings view adds the add-booking dialog with taken slots visible but disabled and an inline slot-held notice, the detail panel (beside the list on a laptop, an overlay on a tablet, the whole page on a phone) with cancel and mark-paid confirmations, and a Bookings item in the dashboard navigation for staff and owner alike.
- **Affected Docs**: booking-management, message-delivery, bookings (view), phase-4-operations
- **Reason**: Implementing `phase-4-operations/booking-management`. The spec's open questions are settled: a manual entry sends the customer their booking link, and rescheduling is cancel plus a new entry.

## [2026-11-21] — Site content API

- **Type**: Feature Change
- **Summary**: Site content is stored and editable. `site_content` keeps one row per fixed key (`description`, `policy`, `contact_phone`, `contact_whatsapp`) with an Arabic and an English value. `GET /api/v1/content` reads them anonymously; `GET` and `PUT /api/v1/staff/content` are owner-only, and a save upserts the supplied keys in one transaction and writes one append-only audit row naming every changed key with its before and after. Empty text clears a value; a contact number is stored once and read in both languages; unknown keys, duplicate keys and text past each key's limit are refused.
- **Affected Docs**: content-management, data-model, phase-5-public-site
- **Reason**: Implementing `phase-5-public-site/content-management`, first item.

## [2026-11-21] — Venue media upload and ordering

- **Type**: Feature Change
- **Summary**: The owner can upload, order, describe and remove venue photos and videos. `media_asset` stores the kind, file path, MIME type, byte size, position and Arabic/English alternative text; files are streamed to random names under `media/` on the upload volume and are never purged. `POST /api/v1/staff/media` takes a multipart upload and checks the type and the size limit before writing, `PATCH` and `DELETE /api/v1/staff/media/{id}` change the text/order and remove the row with its file, and `GET /api/v1/staff/media` returns the ordered list with the limits and free disk space. `GET /api/v1/media/{id}` streams a file anonymously with an immutable cache header. The public content answer now carries the ordered media list. Venue settings gain `maxPhotoMb` (20 default) and `maxVideoMb` (200 default), editable on the settings screen. A full volume refuses the upload with `STORAGE_FULL`.
- **Affected Docs**: content-management, venue-settings, data-model, phase-5-public-site
- **Reason**: Implementing `phase-5-public-site/content-management`, second item.

## [2026-11-21] — Content editor screens

- **Type**: Feature Change
- **Summary**: The owner edits the site at `/dashboard/content`, reached from a new owner-only Content item in the dashboard navigation. The screen pairs Arabic and English description and policy fields (with a same-as-Arabic hint), the two contact numbers, and a sticky save bar that appears only when text is dirty; leaving the page with unsaved text asks first. Below it, a media manager uploads several photos or videos at once with per-file progress, checks type and the settings limit before sending, shows the free volume space, keeps the first photo as the hero, reorders by drag or move buttons, edits alternative text in both languages, and deletes with a confirmation. A "View site" link opens the landing page in a new tab.
- **Affected Docs**: content-management (design), phase-5-public-site
- **Reason**: Implementing `phase-5-public-site/content-management`, third item.

## [2026-11-21] — Landing page

- **Type**: Feature Change
- **Summary**: The public home page is live at `/` (Arabic) and `/en`. It is server-rendered from content management and venue settings: the first photo is the hero, the description is set as paragraphs beside the venue name, and the remaining photos and videos fill a gallery whose first tile is double width. The gallery opens a focus-trapping lightbox with arrow-key and button navigation, and videos play only on tap, muted. Occasion cards show the localized name and price with the deposit percentage beside them, the policy text is a collapsible numbered list (one rule per line), and the contact block carries the phone and WhatsApp actions with a sticky bar on phones. Empty occasions become a contact prompt; no media omits the hero and gallery. The header gains "Find my booking" on the landing page, and the language switch stays on the same page.
- **Affected Docs**: landing-page, content-management, home (view), phase-5-public-site
- **Reason**: Implementing `phase-5-public-site/landing-page`, first item.

## [2026-11-21] — Landing page calendar entry

- **Type**: Feature Change
- **Summary**: The landing page's occasion cards and its primary action lead into the calendar, and the occasion survives the rest of the path: the calendar accepts `?occasion={id}`, carries it into every bookable slot's link, and the booking form starts with that occasion selected, showing its deposit. An occasion that is no longer offered is ignored, so the form still asks for a choice.
- **Affected Docs**: landing-page, phase-5-public-site
- **Reason**: Implementing `phase-5-public-site/landing-page`, second item.

## [2026-11-21] — Landing page metadata

- **Type**: Feature Change
- **Summary**: The home page carries search and share metadata. Arabic is canonical at `/`, English at `/en`, and each language advertises both URLs plus `x-default` through `hreflang` links. The title pairs the venue name with the tagline; the description is the owner's own text in the reader's language (falling back to Arabic, then the tagline); Open Graph and Twitter cards carry the first venue photo as the share image with the owner's alternative text. The origin comes from `PUBLIC_BASE_URL`, then `BETTER_AUTH_URL`, then the development default. The metadata and the page share one content read per request.
- **Affected Docs**: landing-page, phase-5-public-site
- **Reason**: Implementing `phase-5-public-site/landing-page`, third item.

## [2026-11-21] — Range requests for media

- **Type**: Feature Change
- **Summary**: Venue photos and videos stream from the volume with byte-range support: a single `Range` header returns `206` with `Content-Range` and only that slice, an open-ended or suffix range is clamped to the file, a start past the end returns `416` with `bytes */size`, and several or malformed ranges fall back to the whole file. Every answer advertises `Accept-Ranges: bytes`, carries an `ETag` and `Cache-Control: public, max-age=31536000, immutable`, and answers a matching `If-None-Match` with `304`. A row whose file is gone answers `404` instead of an empty `200`.
- **Affected Docs**: landing-page, phase-5-public-site
- **Reason**: Implementing `phase-5-public-site/landing-page`, fourth item.

## [2026-11-21] — End-to-end booking journey from the landing page

- **Type**: Test
- **Summary**: A Playwright test walks the whole customer path in Arabic and English: open the home page, pick an occasion card, land on the calendar carrying that occasion, open a free day, follow the slot's book link, submit the details, receive the verification code, hold the slot, open the private booking page and upload the transfer screenshot. It asserts the booking reaches `proof_submitted` with its file in the database, seeds its own verification code so it needs no provider, and removes its bookings, codes and files afterwards. The Playwright server now runs the log-only message sender and its own base URL.
- **Affected Docs**: landing-page, phase-5-public-site
- **Reason**: Implementing `phase-5-public-site/landing-page`, fifth item.

## [2026-11-21] — Public views pass WCAG AA

- **Type**: Feature Change
- **Summary**: The public views are audited with axe-core against the WCAG 2.0/2.1/2.2 A and AA tags in a Playwright test: home in Arabic, English and dark mode, the calendar in light and dark, the booking form, find-booking and a private booking page. Each scan must report zero violations, and the home and calendar must not scroll sideways at 360px. The audit found one real defect: a selected calendar day carried `text-fg` as well as `text-brand-fg`, so the day number rendered dark on the oxblood pill at 1.47:1; the unselected colours are now applied only when unselected. The phones-only contact bar became a labelled navigation landmark.
- **Affected Docs**: landing-page, home (view), calendar (view), phase-5-public-site
- **Reason**: Implementing `phase-5-public-site/landing-page`, sixth item.

## [2026-11-21] — Public site shipped

- **Type**: Feature Change
- **Summary**: Phase 5 ships: the owner maintains bilingual site text and ordered photos and videos from `/dashboard/content`, and the public home page presents them with prices, policy, contact, a gallery lightbox, SEO/Open Graph metadata, range-served media and WCAG AA in both languages and both themes. The landing page's occasion cards carry the choice into the calendar and booking form. Content Management and Landing Page are complete; the roadmap advances to phase 6.
- **Affected Docs**: content-management, landing-page, home (view), phase-5-public-site
- **Reason**: Completing `phase-5-public-site`; the home mockup is archived now that the live page is the visual truth.

## [2026-11-21] - Booking management verification fixes

- **Type**: Bug Fix / Design Change
- **Summary**: The bookings view now holds its documented layout at every breakpoint: cards below `lg`, a compact table from `lg` (with the detail as an overlay), and the side-by-side panel at `xl`, with the table contained instead of covering or scrolling the page. An inverted date range shows a field error and keeps the filters and Add booking instead of replacing the page with a load error; a server-side list failure now renders the view with its filters and an inline Retry. The mark-paid confirmation closes on success and shows its failure inside the dialog; the cancel dialog shows its failure there too. Closing the detail returns focus to the visible row (table or card) and, below `xl`, the panel traps focus, closes on Escape and is labelled as the booking detail. A held booking's detail gains Mark proof received (optionally confirming in one step), matching the view doc. Staff choose the language of the customer's manual-entry message, the add dialog offers a retry when slots fail to load, an unknown slot holder no longer renders an empty name, and the dashboard header no longer overflows at 320px. The e2e spec no longer presses Escape after mark-paid, since the dialog now closes itself.
- **Affected Docs**: booking-management, bookings (view)
- **Reason**: `axiom:review`, `axiom:integration-check`, `axiom:test` and `axiom:ui-check` on the shipped section; the owner asked for every finding fixed.

