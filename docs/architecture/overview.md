---
id: overview
type: architecture
title: System Overview
last_modified: 2026-11-15
review: draft
depends_on: []
components: [web, postgres, upload-volume]
---

# System Overview

## Scope

The shape of the whole system: what runs, what talks to what, where each concern lives, how it is deployed, how the system fails, and what the shape makes cheap or expensive to change. Entities and their ownership are in `data-model`; the critical flows are traced in `flows`; trust boundaries and roles are in `auth`; test discipline is in `testing`.

## Context

```mermaid
flowchart LR
  customer([Customer<br/>phone browser])
  staff([Owner and staff<br/>phone or laptop browser])
  mobile([Mobile app<br/>later])
  twilio[[Twilio<br/>WhatsApp + SMS]]
  wallet[[Vodafone Cash / InstaPay<br/>out of band]]
  subgraph wesal [Wesal on Fly.io, ams]
    system[Wesal system]
  end
  customer -- pages and JSON API over HTTPS --> system
  staff -- dashboard and JSON API over HTTPS --> system
  mobile -. same JSON API .-> system
  system -- send message --> twilio
  twilio -- delivery status webhook --> system
  twilio -- WhatsApp or SMS --> customer
  twilio -- WhatsApp or SMS --> staff
  customer -. deposit transfer .-> wallet
  wallet -. owner checks by eye .-> staff
```

Three kinds of people reach the system, all over HTTPS: customers on phones, the owner and staff in the dashboard, and later the mobile app through the same JSON API. Twilio is the only external system Wesal calls, and the only one that calls back. The deposit itself never touches Wesal: the customer transfers it through Vodafone Cash or InstaPay and the owner checks his own phone. That edge is drawn dotted because no data crosses it; the screenshot is the only trace.

## Components

| Component | Responsibility | Owns |
|---|---|---|
| `web` | Serves the public site, the dashboard and the versioned JSON API, applies the booking rules, and runs the in-process job loop | No persistent state of its own |
| `postgres` | Stores every record and rejects any active booking that overlaps another | All relational data |
| `upload-volume` | Holds files on the app machine's Fly volume | Venue photos and videos; payment screenshots for one day |

```mermaid
flowchart TB
  browser([Browsers])
  twilio[[Twilio]]
  subgraph appmachine [App machine, always on]
    subgraph web [web: Next.js]
      pages[Pages<br/>server-rendered site and dashboard]
      api[JSON API /api/v1<br/>HTTP wrapper]
      ops[Operations<br/>validate and authorize]
      services[Service layer<br/>booking rules]
      jobs[Job loop<br/>outbox, sweep, purge]
      adapter[Messaging adapter]
    end
    volume[(upload-volume<br/>/data)]
  end
  subgraph dbmachine [Database machine]
    postgres[(postgres)]
  end
  browser --> pages
  browser --> api
  pages -- in-process --> ops
  api --> ops
  ops --> services
  jobs --> services
  services --> postgres
  services --> volume
  services --> adapter
  adapter --> twilio
  twilio -- status webhook --> api
```

`web` is one Next.js process. The boxes inside it are code boundaries, not separately deployed parts.

Every operation the system offers is one **operation function**: it validates its input, checks who is calling, and then calls the service layer. Each `/api/v1` endpoint is a thin HTTP wrapper around exactly one operation. Server-rendered pages call the same operation functions in-process instead of making an HTTP request to their own server (ADR-020); code running in the browser always goes through HTTP. So there are two ways to reach an operation and one way through it: nothing reaches the service layer from outside without passing an operation's validation and authorization. The job loop is the only caller that enters the service layer directly, because it acts for the system and not for a person.

The service layer is the single place booking rules live and the only code that touches `postgres` or `upload-volume`. The messaging adapter isolates Twilio so the provider can be swapped.

`web` has two jobs (serving requests and running timed work) in one process. That is a deliberate consequence of choosing a single machine (ADR-009); the two are separated in code by the service layer and can be split into a worker later.

## Contracts

| From | To | Mode | Protocol | Carries | Initiator |
|---|---|---|---|---|---|
| Browser (public, staff) | `web` | sync | HTTPS: server-rendered pages and JSON API `/api/v1/*` | Page requests; booking, verification, upload, review and settings operations | Browser |
| Pages (server render) | Operations, inside `web` | sync | In-process function call | The same inputs and results as the matching endpoint, plus the caller's session | Page render |
| `web` | `postgres` | sync | SQL over Fly private network, via Drizzle | All reads and writes; transactions for hold creation and status changes | `web` |
| Release machine (per deploy) | `postgres` | sync | SQL over Fly private network | Pending Drizzle migrations | Fly, on deploy |
| `web` | `upload-volume` | sync | Local filesystem | Write and read media and screenshots; delete on purge | `web` |
| `web` | Twilio | sync for verification codes; async through the outbox for everything else | HTTPS REST | Recipient, channel, rendered template text | `web` |
| Twilio | `web` | async | HTTPS webhook with signature check | Delivery status per message | Twilio |
| Fly | `web` | sync, periodic | HTTP `GET` health endpoint | Web server up, database reachable, age of the job loop's last tick | Fly |
| Mobile app (later) | `web` | sync | The same JSON API | The same operations as the web UI | Mobile app |

Trust boundaries sit at the operations: anonymous visitor, holder of a booking link or ID, staff, owner. Authorization is enforced inside the operation function, so it applies equally to an HTTP call and to a server render; the HTTP wrapper and the pages carry no authorization logic of their own, and pages never call the service layer or the database directly. Details are in `auth`.

## Data ownership

`web`'s service layer is the sole writer of every entity; `postgres` stores them; files live on `upload-volume` with a row in `postgres` pointing at each. No other component reads or writes data. The schema itself is changed only by migrations run from the release machine. The only read allowed to be stale is the public calendar, which refreshes about every 30 seconds (ADR-014); the server refuses a double hold regardless of what a stale calendar shows. Entity detail is in `data-model`.

## Flows

Five flows define the system and are traced as sequence diagrams in `flows`:

1. Creating a hold, including two people racing for one slot.
2. Proof upload, staff alert, confirm or reject.
3. Expiry by timestamp, and the tidy-up sweep.
4. Staff entering a phone booking while an online hold is active.
5. A verification code that cannot be delivered (the failure flow).

## Deployment and environments

There are two environments: the developer's machine (with docker-compose Postgres, the fake message sender and CI running the same tests) and production on Fly. There is no staging (ADR-023). The first time a deploy, a migration or the Twilio webhook runs on Fly, it runs in production.

```mermaid
sequenceDiagram
  actor dev as Developer
  participant fly as Fly
  participant rel as Release machine
  participant pg as postgres
  participant web as web
  dev->>fly: fly deploy
  fly->>fly: build image
  fly->>rel: start with new image, no volume
  rel->>pg: apply pending migrations
  alt migration fails
    rel-->>fly: non-zero exit
    fly-->>dev: deploy aborted, old web keeps serving
  else migration succeeds
    rel-->>fly: exit 0
    fly->>web: stop old machine, start new one with the volume
    fly->>web: health check
    web-->>fly: healthy
  end
```

A deploy has three steps and the order is what matters. Migrations run first, from a temporary machine built from the new image (ADR-021); it has no volume and exists only for that command. If a migration fails, nothing else happens and the old version keeps serving. Only then is the app machine replaced, which is the brief outage the single-machine shape accepts (ADR-009). For the moment between the two steps the old code runs against the new schema, so a migration must not break the version it replaces: a column or table is added in one deploy and the old one removed in a later deploy.

## Cross-cutting concerns

- **Authentication and authorization.** Better Auth sessions for staff, with owner and staff roles. Customers have no accounts: a booking is reached by its link token or its booking ID. A phone is verified by one-time code before a hold. See `auth`.
- **Configuration and secrets.** Database URL, auth secret and Twilio credentials are Fly secrets. Venue settings (prices, deposit percentage, payment details, hold length, cutoff) live in the database and are edited in the dashboard.
- **Background work.** One loop inside `web` wakes on a short interval and runs three jobs: send due outbox messages, mark overdue holds expired, and once a day purge old screenshots. The app machine must stay running, so Fly auto-stop is off. Each job run is isolated: an error is caught and logged and the loop carries on to the next job and the next tick, and each run has a time limit so a hung call cannot hold the loop. The loop records the time of every tick. A watchdog timer in the same process exits the process when the last tick is too old, and Fly's restart policy starts it again (ADR-022).
- **Health.** One health endpoint reports whether the web server is up, whether `postgres` answers, and the age of the job loop's last tick. Fly uses it to decide whether a new deploy is good; the developer uses it to see at a glance whether jobs are running.
- **Observability.** Fly logs only (ADR-017). Every job run, message failure and unhandled error writes one structured log line with a request or job id. A watchdog exit writes a line naming the stalled loop before the process ends.
- **Error handling.** Operations return a typed error with a stable code; the HTTP wrapper puts it in the error envelope and pages receive the same code in-process. The UI maps codes to bilingual messages. Slot conflict and code-delivery failure have dedicated messages with a next step.
- **Internationalization.** Arabic by default with RTL, English available. The locale chosen at booking is stored on the booking and used for that customer's messages.
- **Audit.** Every staff action on a booking or on settings writes an append-only audit row.
- **Time.** All business time is Africa/Cairo. Services take the current time from an injected clock so tests can control it.

## Failure behavior

| Dependency | If unavailable | Degrades or stops |
|---|---|---|
| `postgres` | No page data and no bookings | Stops. A static notice shows the venue's phone and WhatsApp |
| Twilio, both channels | Codes cannot be sent; outbox messages wait and retry | Degrades. Browsing works, no new online holds, alerts are delayed, not lost |
| Twilio WhatsApp only | Messages fall back to SMS | Degrades |
| `upload-volume` unwritable or full | Media missing; uploads fail | Degrades. The customer can send proof with the WhatsApp button and staff mark it received |
| One job run throws | That run is logged and skipped; the loop continues | Degrades. A message that keeps failing is retried with backoff and then marked failed |
| Job loop stalls | No messages sent, no sweep, no purge until the watchdog fires | Stops briefly. The process exits and restarts; holds stay correct because expiry is by timestamp |
| `web` restart or deploy | Site and job loop pause for a few minutes | Stops briefly. Holds stay correct because expiry is by timestamp |
| Migration fails on deploy | The deploy is aborted before the app machine is touched | Neither. The old version keeps serving on the old schema |
| Database volume lost | Restore from the Fly daily snapshot | Up to a day of bookings is lost (ADR-015) |

## Constraints

- Small scale: a few bookings a week, up to a few hundred visitors a day.
- One developer builds and operates the system.
- Short outages are acceptable.
- A Fly volume attaches to one machine, so `web` runs as exactly one machine while files live on the volume.
- The app machine is small (256 MB class). Nothing may keep a push-style connection (server-sent events or WebSockets) open per visitor, which is why the calendar polls. Ordinary requests, including video streamed in ranges from the volume, are within the constraint.
- An audit trail of staff actions is required.

## Change cost

**Cheap to change:** the messaging provider (behind the adapter); hold length, deposit percentage and cutoff (settings); adding the mobile client (the JSON API already exists); adding occasions; adding a job to the loop; adding a staging environment later (a second Fly app from the same image and configuration).

**Expensive to change:** running a second app machine or deploying without downtime, which both require moving files off the volume first; splitting the job loop into a worker; changing the booking time model away from owner-defined slots; changing the public JSON API after the mobile app ships; a schema change the running version cannot tolerate, which takes two deploys.

## Decisions

- ADR-001 — Next.js and TypeScript, full-stack
- ADR-002 — PostgreSQL, self-run on Fly
- ADR-005 — Files on a Fly volume; screenshots kept one day
- ADR-006 — Messaging adapter with Twilio first
- ADR-007 — Deploy on Fly.io
- ADR-009 — Single app machine with in-process jobs
- ADR-011 — Verification codes inline, everything else through an outbox
- ADR-012 — JSON API from day one, used by the web UI
- ADR-014 — Calendar freshness by 30-second polling
- ADR-015 — Backups by Fly volume snapshots only
- ADR-017 — Observability by Fly logs only
- ADR-020 — Server-rendered pages call operations in-process
- ADR-021 — Migrations run as the Fly release command
- ADR-022 — Job runs are isolated and a stalled loop restarts the process
- ADR-023 — Production is the only deployed environment
