---
id: vision-brief
type: vision-brief
title: Vision Brief
last_modified: 2026-11-15
status: approved
---

## Stage 1: Vision

- **Product name**: Wesal (وصال)
- **Problem**: Booking the Wesal mosque and event hall happens by phone and WhatsApp, so families cannot see what is free or what it costs, dates get held without payment, and the owner has no single reliable calendar.
- **Primary users**: Anyone local booking a wedding, engagement party, nikah or marriage contract signing, or a funeral, all weighted equally. Second user: the venue owner and a few staff.
- **Success criteria**:
  - Every booking, including phone and walk-in bookings, appears on the public calendar.
  - No slot ever has two active bookings.
  - An unpaid hold is released automatically after 20 minutes.
  - A customer can go from the landing page to an uploaded payment proof without contacting the owner.
  - The owner can confirm a booking straight from a notification that includes the screenshot.
- **Project class**: Web app first (Arabic-first, bilingual Arabic/English); mobile app later.
- **Out of scope**:
  - A marketplace of several venues.
  - Card payments or automatic payment checking.
  - Customer accounts and passwords.
  - Collecting the remainder, refunds or cancellations online.
  - Event-planning extras such as catering or decoration.
- **Deferred, still wanted** (from the idea brief's Later list): the mobile app with push notifications; a "tell me if this slot frees up" alert; owner reports of bookings and income.
- **Source**: seed prompt from `docs/_meta/idea-brief.md` (approved 2026-11-14), accepted unchanged. The full brief remains the record of domain decisions.
- **Original seed (verbatim)**:
  > I want to build Wesal (وصال), the booking web app for a single venue: the Wesal mosque and event hall. It lets families see when the venue is free and what it costs, hold a slot from their phone, and secure it with a deposit transfer, without a phone call. It also gives me, the owner, one trustworthy calendar of every booking. It is Arabic-first and fully bilingual, Arabic and English. Project class: a web app first; a mobile app comes later.
  >
  > Users: anyone local booking a wedding, engagement party, nikah or marriage contract signing, or a funeral, all weighted equally. The second user is me and a few staff.
  >
  > How it works: the landing page shows a description, photos and videos, a price per occasion, a policy text, a phone number and a WhatsApp contact, plus a calendar of slots. The customer picks a free slot and an occasion, enters name and phone, and verifies the phone by a code. The slot is held for 20 minutes. A private booking page, with no account, is sent as a link by WhatsApp, or by SMS if WhatsApp is unavailable, and can also be found by booking ID. It shows my Vodafone Cash number or InstaPay address, the deposit amount, the booking ID and a countdown. The customer uploads a screenshot of the transfer, which stops the countdown. I get notified, check the money on my phone, and confirm or reject. A rejected or expired booking frees the slot immediately. Taken slots stay visible but disabled, each showing its state: awaiting payment, awaiting review, confirmed, or closed.
  >
  > Rules: one booking takes the whole venue. I define slots as a weekly pattern with per-date exceptions. Price depends on the occasion only, not the slot. The deposit is one percentage of that price. Two people can never hold the same slot; the second sees a message at once. I and my staff can enter phone and walk-in bookings and I can block dates. Staff can confirm payments and add bookings; only I change prices, slots, payment details and content. The remainder, cancellations and refunds are handled offline; I can cancel a booking and mark the remainder paid.
  >
  > Success means: every booking, including phone bookings, appears on the public calendar; no slot ever has two active bookings; an unpaid hold is released automatically after 20 minutes; a customer can go from the landing page to an uploaded proof without contacting me; and I can confirm a booking straight from a notification that includes the screenshot.
  >
  > Deferred, still wanted after the first version: the mobile app for customers with push notifications for me and my staff; a "tell me if this slot frees up" alert; and owner reports of bookings and income by month and occasion.
  >
  > Out of scope: a marketplace of several venues, card payments or automatic payment checking, customer accounts and passwords, collecting the remainder or refunds online, and event-planning extras such as catering or decoration.

## Stage 2: Capability Map

### Pillars
| Pillar ID | Milestone | One-line description |
|---|---|---|
| public-site | v1 | The bilingual public face of the venue and the content behind it |
| availability | v1 | When the venue can be booked, and how that is shown to the public |
| booking | v1 | The customer's path from picking a slot to an uploaded payment proof |
| back-office | v1 | The owner and staff dashboard that reviews, records and configures |
| messaging | v1 | Automated WhatsApp and SMS to customers, owner and staff |
| mobile-app | later | The booking experience as a mobile app, with push for owner and staff |
| reporting | later | Owner reports on bookings and income |

### Features
| Feature ID | Title | Pillar | Milestone | UI? | One-line purpose |
|---|---|---|---|---|---|
| landing-page | Landing Page | public-site | v1 | yes | Description, photos and videos, price per occasion, policy, phone and WhatsApp contact, Arabic and English |
| content-management | Content Management | public-site | v1 | yes | Owner edits description, media, policy text and contact details |
| slot-schedule | Slot Schedule | availability | v1 | yes | Weekly slot pattern, per-date exceptions, blocked dates |
| public-calendar | Public Calendar | availability | v1 | yes | Calendar showing every slot's state; taken slots visible but disabled |
| slot-alerts | Slot Alerts | availability | later | yes | "Tell me if this slot frees up" |
| booking-hold | Booking Hold | booking | v1 | yes | Pick slot and occasion, name and phone, 20-minute hold, no double holds, automatic expiry |
| phone-verification | Phone Verification | booking | v1 | yes | Code sent to the phone before the hold starts |
| booking-page | Booking Page | booking | v1 | yes | Private page by link or booking ID: transfer details, deposit, countdown, status |
| payment-proof | Payment Proof | booking | v1 | yes | Upload the transfer screenshot or send by WhatsApp button; stops the countdown |
| staff-access | Staff Access | back-office | v1 | yes | Dashboard login; owner and limited-staff roles |
| payment-review | Payment Review | back-office | v1 | yes | Queue of uploaded proofs; confirm or reject |
| booking-management | Booking Management | back-office | v1 | yes | All bookings; enter phone/walk-in bookings, cancel, mark remainder paid |
| venue-settings | Venue Settings | back-office | v1 | yes | Occasions and prices, deposit percentage, Vodafone Cash / InstaPay details |
| message-delivery | Message Delivery | messaging | v1 | no | WhatsApp sending with SMS fallback, Arabic and English texts |
| staff-notifications | Staff Notifications | messaging | v1 | no | Alerts to owner and staff for new proofs and urgent bookings |
| customer-mobile-app | Customer Mobile App | mobile-app | later | yes | The booking experience as a mobile app |
| push-notifications | Push Notifications | mobile-app | later | no | Push alerts for owner and staff |
| booking-reports | Booking Reports | reporting | later | yes | Bookings and income by month and occasion |

Initial cut: 14 features across 5 pillars. Later: 4 features across 3 pillars (slot-alerts sits inside the v1 pillar `availability`).

## Stage 3: Tech Stack

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript on Node | One language for the site, dashboard and server logic; matches the user's zamzam-web and Expo mobile work. |
| Framework | Next.js, full-stack | One codebase; server-rendered landing page for search engines and slow phones; route handlers can serve the mobile app later. |
| Styling | Tailwind CSS | Agent's assumption from zamzam-web, which uses it; logical properties make RTL straightforward. |
| Database | PostgreSQL, self-run on a Fly machine with a volume | Partial unique indexes and row locks enforce one active booking per slot. User chose self-run for cost; backups, upgrades and recovery are the user's to manage. |
| ORM | Drizzle | SQL-shaped and typed; expresses partial unique indexes and row locks directly. |
| Staff auth | Better Auth, password login | Users, sessions and roles stay in the project's own database; customers never log in. |
| File storage | Fly volume attached to the app machine | Same pattern as zamzam. Payment screenshots are kept for one day only and purged after the day ends; the owner saves any he wants elsewhere. Venue photos and videos persist. |
| Messaging | Internal adapter; Twilio as the first provider | Adapter keeps the provider swappable. Twilio's free trial is for testing now; a fake sender covers local development. The production provider is still open. |
| Deployment | Fly.io, Docker build, `ams` region | Same setup as the user's zamzam project. |

## Stage 4: Design Direction

### Visual style
- Style: Elegant / formal (refined, Islamic geometric accents, serif-style Arabic headings)
- Color mood: Light default with a dark toggle
- Density: Generous on the public site, comfortable in the dashboard
- A11y target: WCAG AA

### Components & patterns
- Component library: shadcn/ui on Radix
- Iconography: Lucide
- Animation level: Measured (transitions on key interactions)
- i18n / RTL: Bilingual Arabic/English with RTL from v1; Arabic is the default (settled in Stage 1)

### Top-level views
| View ID | Title | Owning Feature | Milestone | One-line purpose |
|---|---|---|---|---|
| home | Landing | landing-page | v1 | The venue, prices, policy and contact |
| calendar | Availability Calendar | public-calendar | v1 | Pick a day and see each slot's state |
| booking-form | Book a Slot | booking-hold | v1 | Occasion, name, phone, verification code |
| booking-status | Booking Page | booking-page | v1 | Transfer details, countdown, upload, status |
| review-queue | Payment Review | payment-review | v1 | Uploaded proofs waiting for confirm or reject |
| bookings | Bookings | booking-management | v1 | All bookings; add phone/walk-in, cancel, mark paid |
| schedule-editor | Slot Schedule | slot-schedule | v1 | Weekly pattern, exceptions, blocked dates |
| slot-alert-signup | Slot Alert Signup | slot-alerts | later | Ask to be told when a taken slot frees up |
| mobile-home | Mobile Home | customer-mobile-app | later | The app's entry screen: venue and calendar |
| reports | Reports | booking-reports | later | Bookings and income by month and occasion |

Login, settings and content-editing screens are added by `axiom:section` when their sections are built.

## Stage 5: Architecture

- **Depth**: full. Detail lives in `docs/architecture/` (overview, data-model, flows, auth); this section is the summary.
- **Constraints**: small scale; one developer builds and operates; short outages acceptable; audit trail of staff actions required; Fly.io, `ams`, Docker; a Fly volume attaches to one machine.
- **Shape**: one always-on Next.js app machine plus a self-run Postgres machine. Chosen as the smallest shape that meets the constraints. A separate worker lost because it is a second machine that could not reach the upload volume; a separate API service lost because it means two deployables for one developer.

### Components
| Component | Responsibility | Owns |
|---|---|---|
| web | Public site, dashboard, versioned JSON API, booking rules, in-process job loop | No persistent state |
| postgres | Stores every record; rejects overlapping active bookings | All relational data |
| upload-volume | Files on the app machine's Fly volume | Venue media; payment screenshots for one day |

External: Twilio (WhatsApp + SMS). Vodafone Cash and InstaPay are out of band.

### Critical flows
- Creating a hold, including two people racing for one slot
- Proof upload, staff alert, confirm or reject
- Expiry by timestamp, and the tidy-up sweep
- Staff entering a phone booking while an online hold is active
- A verification code that cannot be delivered (failure flow)

### Document plan
- `overview` — context and component diagrams, contracts, cross-cutting concerns, failure behavior, change cost
- `data-model` — entity diagram, database invariants, booking state machine, retention
- `flows` — five sequence diagrams
- `auth` — access levels, staff roles, booking access without accounts, phone verification, audit
- `testing` — from Stage 5b

### Decisions recorded
ADR-009 single app machine with in-process jobs; ADR-010 hold expiry by timestamp; ADR-011 codes inline, the rest via outbox; ADR-012 JSON API from day one; ADR-013 staff alert carries a link; ADR-014 calendar polling; ADR-015 backups by Fly snapshots only; ADR-016 failed verification stops the booking; ADR-017 Fly logs only.

### Weaknesses named at self-critique
- A crash or deploy of the single machine pauses message sending and the purge along with the site.
- Snapshots-only backup can lose up to a day of bookings.
- No error alerting beyond logs.

## Stage 5b: Testing Strategy

### Pyramid
- Unit: 35% — pure rules: slot generation from pattern and exceptions, deposit calculation, status transitions, message templates
- Integration: 55% — JSON API endpoints against real Postgres and a temp upload directory: overlap constraint, expiry by timestamp, races, roles, outbox
- E2E: 10% — the booking journey and the review journey in a browser, in Arabic (RTL) and English

### Tooling
- Unit + integration runner: Vitest — TypeScript-native, fast, already used in zamzam-web
- E2E runner: Playwright — multi-browser, mobile emulation, RTL screenshots
- Coverage tool: Vitest v8 coverage
- Mocking philosophy: mock at boundaries only — real Postgres and filesystem; Twilio replaced by the fake sender behind the messaging adapter; time through an injected clock
- API contract testing: covered by integration tests

### Conventions
- Test location: co-located (`booking.ts` beside `booking.test.ts`); e2e in top-level `e2e/`
- Naming: `*.test.ts` / `*.test.tsx`; e2e `*.spec.ts`
- Fixtures: `src/test/` (factories, database helpers, fake clock, fake sender)

### Coverage targets
- Lines: 80% (block)
- Branches: 70% (block)

### CI gating
- Block merge on any test failure or coverage drop below target. CI assumed to be GitHub Actions; the project is not yet a git repository.

## Stage 6: Roadmap

### Phase 1 — Infrastructure (`phase-1-infrastructure`) — milestone: v1
- **project-setup** — The Next.js application skeleton that every later section builds on. Builds the `web` component: TypeScript, Tailwind, shadcn/ui, bilingual routing with RTL, and the JSON API conventions.
  - [ ] Scaffold Next.js App Router project with strict TypeScript, ESLint and Prettier
  - [ ] Add Tailwind CSS and shadcn/ui with logical-property (RTL-safe) defaults
  - [ ] Add locale routing: Arabic default (RTL) and English, with message catalogs
  - [ ] Add `/api/v1` conventions: zod validation, typed error envelope, error codes
  - [ ] Add structured logger and injectable clock used by all services
  - [ ] Add light/dark theme toggle wired to design tokens
- **database** — The data layer. Builds the `postgres` component for local development and test, with Drizzle migrations.
  - [ ] Add docker-compose Postgres for local development and tests
  - [ ] Configure Drizzle with migrations and a typed database client
  - [ ] Enable the btree_gist extension in the first migration
  - [ ] Add dev seed script: owner account, sample occasions, weekly slot pattern
- **testing** — The test tooling and CI gates decided in the testing strategy.
  - [ ] Install Vitest + v8 coverage; add `test` and `coverage` scripts
  - [ ] Configure Vitest projects: unit, and integration against real Postgres with per-test isolation
  - [ ] Add test scaffold under src/test: factories, database helper, fake clock, fake sender
  - [ ] Install Playwright; write smoke test loading the home page in Arabic and English
  - [ ] Wire GitHub Actions to run lint, typecheck and tests on every PR; block on failure
  - [ ] Enforce 80% line / 70% branch coverage in CI; block on drop
  - [ ] Add CONTRIBUTING note pointing to docs/architecture/testing.md as the source of truth
- **deployment** — Production on Fly.io. Builds the production `postgres` machine and the `upload-volume` component, and ships `web`.
  - [ ] Write Dockerfile and fly.toml for the app (ams region, always on, no auto-stop)
  - [ ] Provision self-run Postgres machine with a volume and daily snapshots
  - [ ] Create and mount the upload volume at /data with media and proofs directories
  - [ ] Set Fly secrets (database URL, auth secret, Twilio) and document the deploy steps
  - [ ] Add health endpoint and static fallback notice with venue phone and WhatsApp

### Phase 2 — Foundations (`phase-2-foundations`) — milestone: v1
- **staff-access** — Dashboard login, roles and the audit log. Extends `web`; data in `postgres`.
  - [ ] Integrate Better Auth with password login and Drizzle-backed sessions
  - [ ] Add owner and staff roles with an API authorization guard
  - [ ] Implement dashboard shell and login screen in Arabic and English
  - [ ] Implement staff account management for the owner (create, disable, reset password)
  - [ ] Implement audit-log table and helper recording every staff action
- **venue-settings** — Occasions, prices, deposit and payment details. Extends `web`; data in `postgres`.
  - [ ] Implement occasion CRUD API with Arabic/English names and price
  - [ ] Implement settings API: deposit %, payment details, hold length, near-slot cutoff
  - [ ] Implement owner-only settings screens for occasions, deposit and payment details
- **slot-schedule** — The weekly slot pattern, date exceptions and blocked dates. Extends `web`; data in `postgres`.
  - [ ] Implement weekly slot pattern schema and API with overlap validation
  - [ ] Implement date exceptions: custom slots for a date, or the date closed
  - [ ] Implement slot resolver returning a date's slots from pattern plus exceptions
  - [ ] Guard schedule edits against dates that have active bookings
  - [ ] Implement schedule-editor view: weekly grid, exceptions list, block a date
- **message-delivery** — The messaging adapter, the outbox and the in-process job loop inside `web`; talks to Twilio.
  - [ ] Define messaging adapter interface with fake sender and Twilio implementation
  - [ ] Implement outbox table and in-process job loop with retry and backoff
  - [ ] Implement Twilio status webhook with signature check and SMS fallback
  - [ ] Add bilingual message templates: code, booking link, staff alert
- **phone-verification** — One-time codes that gate a hold. Extends `web`; data in `postgres`.
  - [ ] Implement request-code endpoint: hashed code, expiry, rate limits per phone and IP
  - [ ] Implement check-code endpoint issuing a short-lived verified-phone token
  - [ ] Implement delivery-failure response carrying venue phone and WhatsApp contact
  - [ ] Implement code entry step UI with resend timer and error states

### Phase 3 — Booking (`phase-3-booking`) — milestone: v1
- **public-calendar** — The public view of availability. Extends `web`; reads `postgres`.
  - [ ] Implement availability API: slot states for a date range with expiry by timestamp
  - [ ] Implement calendar view: month picker, day slots, state labels, disabled taken slots
  - [ ] Add 30-second and on-focus refresh of slot states
- **booking-hold** — Creating a 20-minute hold with no double booking. Extends `web`; constraint lives in `postgres`.
  - [ ] Add bookings table with exclusion constraint on overlapping active time ranges
  - [ ] Implement create-hold endpoint: verified phone, transaction, conflict error
  - [ ] Implement near-slot deadline cutoff and urgent flag
  - [ ] Implement tidy-up sweep in the job loop marking overdue holds expired
  - [ ] Implement booking-form view: occasion, name, phone, conflict message
  - [ ] Queue the booking-link message on hold creation
- **booking-page** — The private page a customer returns to. Extends `web`; reads `postgres`.
  - [ ] Implement booking read API by link token and rate-limited lookup by booking ID
  - [ ] Implement booking-status view: transfer details, deposit, countdown, status
  - [ ] Implement find-my-booking form by booking ID
- **payment-proof** — Uploading the transfer screenshot. Extends `web`; files on `upload-volume`.
  - [ ] Implement proof upload endpoint: type and size checks, store on volume, stop countdown
  - [ ] Implement upload UI and WhatsApp button prefilled with the booking ID
  - [ ] Implement daily purge of proof files older than one day

### Phase 4 — Operations (`phase-4-operations`) — milestone: v1
- **payment-review** — Staff confirm or reject uploaded proofs. Extends `web`; reads `upload-volume`.
  - [ ] Implement review queue API and confirm/reject endpoints with audit entries
  - [ ] Implement review-queue view with screenshot viewer and confirm/reject actions
  - [ ] Implement deep link from a staff alert to that booking's review page after login
  - [ ] Implement mark-proof-received for screenshots sent over WhatsApp
  - [ ] Write e2e test: staff reviews, confirms and rejects a booking
- **staff-notifications** — Alerts to owner and staff through the outbox in `web`.
  - [ ] Queue staff alert on proof upload with a link to the review page
  - [ ] Queue urgent alert for holds on slots starting soon
  - [ ] Implement per-staff notification phone and opt-in setting
- **booking-management** — The full list of bookings and manual entry. Extends `web`.
  - [ ] Implement bookings list API with filters by date, status and source
  - [ ] Implement phone/walk-in booking entry with conflict handling
  - [ ] Implement cancel booking and mark remainder paid, with audit entries
  - [ ] Implement bookings view: list, detail, add-booking dialog

### Phase 5 — Public Site (`phase-5-public-site`) — milestone: v1
- **content-management** — Owner-editable content and media. Extends `web`; files on `upload-volume`.
  - [ ] Implement site content API: description, policy, contact in Arabic and English
  - [ ] Implement media upload and ordering for photos and videos on the volume
  - [ ] Implement owner-only content editor screens
- **landing-page** — The public home page. Extends `web`.
  - [ ] Implement home view: hero, gallery, occasion prices, policy, contact
  - [ ] Add calendar entry point and booking call to action
  - [ ] Add SEO metadata, Open Graph and hreflang for Arabic and English
  - [ ] Serve media with range requests and caching headers
  - [ ] Write e2e test: booking journey from home to uploaded proof in both languages
  - [ ] Run WCAG AA pass on public views and fix findings

### Phase 6 — Alerts and Reports (`phase-6-alerts-and-reports`) — milestone: later
- **slot-alerts** — "Tell me if this slot frees up" for people watching a taken slot.
  - [ ] Implement alert signup on a taken slot with phone verification
  - [ ] Notify subscribers through the outbox when the slot becomes free
- **booking-reports** — Owner reports on bookings and income.
  - [ ] Implement reports API: bookings and income by month and occasion
  - [ ] Implement reports view with period filter and export

### Phase 7 — Mobile App (`phase-7-mobile-app`) — milestone: later
- **customer-mobile-app** — The booking experience as a mobile app over the same JSON API.
  - [ ] Scaffold Expo app with Arabic/English and RTL, consuming `/api/v1`
  - [ ] Implement calendar, booking form, booking page and proof upload screens
  - [ ] Produce Android and iOS store builds
- **push-notifications** — Push alerts for owner and staff.
  - [ ] Implement device registration endpoint and a push sender behind the messaging adapter
  - [ ] Send push on proof upload and urgent holds to signed-in staff devices
