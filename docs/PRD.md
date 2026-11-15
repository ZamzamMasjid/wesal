---
id: prd
type: prd
title: Wesal
last_modified: 2026-11-15
pillars: [public-site, availability, booking, back-office, messaging, mobile-app, reporting]
---

# Wesal

## Vision

Wesal (وصال) is the booking web app for a single venue: the Wesal mosque and event hall. Families book it for Islamic occasions: weddings, engagement parties, nikah and marriage contract signings, and funerals.

Today the venue is booked by phone and WhatsApp. Families cannot see what is free or what it costs, dates get held without payment, and the owner has no single reliable calendar. Wesal shows real availability and prices publicly, lets a family hold a slot for 20 minutes from their phone, and secures the booking with a deposit transfer (Vodafone Cash or InstaPay) and an uploaded screenshot that the owner checks and confirms. Any hold that is not paid for releases itself.

The product has two halves of equal weight: booking without a phone call for families, and one trustworthy calendar of every booking, online or not, for the owner. It is a web app first, Arabic-first and fully bilingual; a mobile app follows.

## Target users

- **Families booking an occasion.** Anyone local arranging a wedding, engagement party, nikah or marriage contract signing, or a funeral. All occasions are weighted equally. They use a phone, pay by Vodafone Cash or InstaPay, and never create an account.
- **The venue owner.** Reviews payment proofs, enters phone and walk-in bookings, and controls prices, slots, payment details and site content.
- **Venue staff.** A few people with limited rights: they confirm or reject payments and add bookings, but cannot change prices, slots, payment details or content.

## Success criteria

- Every booking, including phone and walk-in bookings, appears on the public calendar.
- No slot ever has two active bookings.
- An unpaid hold is released automatically after 20 minutes.
- A customer can go from the landing page to an uploaded payment proof without contacting the owner.
- The owner can confirm a booking straight from a notification that links to the screenshot.

## Capability pillars

The product is organized into capability pillars. Each pillar is implemented by one or more features in `docs/features/`.

### v1

- **public-site** — The bilingual public face of the venue: description, photos and videos, price per occasion, policy text, phone and WhatsApp contact, and the owner's tools for editing that content.
- **availability** — When the venue can be booked and how that is shown: the owner's weekly slot pattern with per-date exceptions and blocked dates, and the public calendar where taken slots stay visible but disabled. (The slot-alerts feature in this pillar comes later.)
- **booking** — The customer's path from picking a slot to an uploaded payment proof: phone verification, the 20-minute hold, the private booking page, and the proof upload.
- **back-office** — The dashboard for owner and staff: login and roles, payment review, the list of all bookings with manual entry, and venue settings.
- **messaging** — Automated WhatsApp messages with SMS fallback to customers, and alerts to owner and staff.

### Later

Fully specified and scheduled, just further down the roadmap — the first push is deliberately smaller than the whole product. Reorder with `/axiom:amend`.

- **mobile-app** — The booking experience as a mobile app over the same JSON API, with push notifications for owner and staff.
- **reporting** — Owner reports on bookings and income by month and by occasion.

## Cross-cutting non-functional requirements

- **Language and direction.** Arabic is the default, laid out right-to-left. English is fully supported. Every user-facing string, including WhatsApp and SMS templates, exists in both languages.
- **Accessibility.** WCAG AA on all views: contrast, visible focus, keyboard operation, labelled form fields, reduced-motion support.
- **Integrity.** The database, not application code alone, guarantees that no two active bookings overlap. Hold expiry is decided by timestamp, so it is correct even when background jobs are not running.
- **Audit.** Every staff action on a booking or on settings is recorded with the actor and the time.
- **Privacy.** A booking is reachable only through its unguessable link or its random booking ID. Payment screenshots never leave the server and are kept for one day.
- **Scale.** Small: a few bookings a week and up to a few hundred visitors a day. One developer builds and operates the system.
- **Availability.** Short outages during deploys or restarts are acceptable. One always-on app machine.
- **Time and money.** All slot times are in Africa/Cairo. Prices and deposits are in EGP.
- **Observability.** Fly logs only; structured log lines for jobs, message failures and errors.
- **Backups.** Fly volume snapshots only; up to a day of data can be lost if the database volume fails.

## Tech stack summary

High-level tech choices. Detailed rationale lives in `docs/decisions/` ADRs.

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript on Node | One language for the site, dashboard and server logic. |
| Framework | Next.js, full-stack | One codebase; server-rendered landing page; route handlers serve the JSON API. |
| Styling | Tailwind CSS | Logical properties make RTL straightforward. |
| Components | shadcn/ui on Radix, Lucide icons | Accessible primitives restyled to the elegant, formal look. |
| Database | PostgreSQL, self-run on a Fly machine | Exclusion constraints and row locks enforce one active booking per slot. |
| ORM | Drizzle | SQL-shaped and typed; constraints expressed directly. |
| Staff auth | Better Auth, password login | Users, sessions and roles in the project's own database. |
| File storage | Fly volume on the app machine | Payment screenshots kept one day; venue media persists. |
| Messaging | Internal adapter; Twilio first | Provider stays swappable; Twilio trial for testing. Production provider still open. |
| Deployment | Fly.io, Docker, `ams` | Same setup as the owner's other project. |
| Testing | Vitest, Playwright | Integration-heavy against real Postgres. |

## Glossary

- **Occasion** — The kind of event being booked (wedding, engagement, nikah, funeral, …). Each has one price.
- **Slot** — A bookable period on a date, with a start and end time set by the owner.
- **Weekly pattern** — The slots that apply to each weekday by default.
- **Date exception** — A specific date whose slots differ from the pattern, or which is closed.
- **Hold** — A provisional booking that reserves a slot for 20 minutes while the customer pays the deposit.
- **Deposit (العربون)** — A site-wide percentage of the occasion price, transferred to secure the booking.
- **Payment proof** — The screenshot of the transfer, uploaded by the customer or received over WhatsApp.
- **Booking ID** — The short random code shown to the customer and used to find a booking.
- **Active booking** — A booking that blocks its slot: held (deadline not passed), proof submitted, or confirmed.
- **Outbox** — The table of messages waiting to be sent by the background loop.

## Out of scope

- A marketplace of several venues. Wesal is one venue.
- Card payments or automatic payment checking. The owner verifies transfers by eye.
- Customer accounts and passwords.
- Collecting the remainder, refunds or cancellations online. These are handled offline.
- Event-planning extras such as catering or decoration.
