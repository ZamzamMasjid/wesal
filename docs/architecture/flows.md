---
id: flows
type: architecture
title: Critical Flows
last_modified: 2026-11-15
review: draft
depends_on: [overview, data-model]
components: []
---

# Critical Flows

## Scope

The five flows that define Wesal, traced end to end through the components in `overview` and the entities in `data-model`. Screen-level behavior is in the feature specs and view docs; this doc fixes the order of operations and where each rule is enforced. It defines no components.

## Context

Every flow starts at a browser (or at the job loop inside `web`), passes through the JSON API into the service layer, and touches `postgres`, `upload-volume` or Twilio from there. In the diagrams, "web" means the API plus service layer unless the job loop is named.

## Flow 1: Creating a hold, with a race

```mermaid
sequenceDiagram
  autonumber
  participant A as Customer A
  participant B as Customer B
  participant W as web
  participant P as postgres
  participant T as Twilio
  A->>W: POST /verification/request (phone)
  W->>P: store hashed code
  W->>T: send code (inline, WhatsApp then SMS)
  T-->>A: code
  A->>W: POST /verification/check (phone, code)
  W-->>A: verified-phone token
  par A and B submit the same slot
    A->>W: POST /bookings (slot, occasion, name, token)
    B->>W: POST /bookings (same slot, own token)
  end
  W->>P: tx A: expire overdue hold on range, insert held booking
  P-->>W: ok
  W->>P: tx B: expire overdue hold on range, insert held booking
  P-->>W: exclusion constraint violation
  W->>P: queue booking-link message for A (outbox)
  W-->>A: 201 booking id, link token, deadline, deposit
  W-->>B: 409 SLOT_TAKEN
  Note over B: "This slot is being booked by someone else"
```

The verification code is the only message sent inside a request, because the customer is waiting for it (ADR-011). The hold itself is one transaction, and the database decides the race: whichever insert commits first wins and the other receives a constraint violation, which the API reports as `SLOT_TAKEN`. Customer B went through verification too; a verified phone earns the right to try, not the slot. The deadline is the hold length from settings, shortened if the slot starts soon (see `booking-hold`).

## Flow 2: Proof upload, staff alert, confirm or reject

```mermaid
sequenceDiagram
  autonumber
  participant C as Customer
  participant W as web
  participant V as upload-volume
  participant P as postgres
  participant J as Job loop (web)
  participant T as Twilio
  participant S as Staff
  C->>W: POST /bookings/by-token/{token}/proof (image)
  W->>P: check booking is held and deadline not passed
  W->>V: write file
  W->>P: tx: insert proof, status proof_submitted, queue staff alert
  W-->>C: status awaiting review, countdown stopped
  J->>P: take due outbox messages
  J->>T: send staff alert with link to review page
  T-->>S: WhatsApp or SMS
  S->>W: open link, log in if needed
  W->>V: read screenshot
  W-->>S: review page
  alt money arrived
    S->>W: POST /staff/bookings/{id}/confirm
    W->>P: tx: status confirmed, audit row
  else money not found
    S->>W: POST /staff/bookings/{id}/reject
    W->>P: tx: status rejected, audit row
    Note over P: slot is free at once
  end
```

Uploading stops the clock: from `proof_submitted` on, only a staff decision moves the booking. The alert carries a link, never the image (ADR-013), so the screenshot is only ever served to a logged-in staff session. If the customer sends the screenshot over WhatsApp instead, staff use "mark proof received", which performs step 4 without a file. A rejected booking frees the slot immediately and the customer starts again.

## Flow 3: Expiry by timestamp, and the sweep

```mermaid
sequenceDiagram
  autonumber
  participant V as Visitor
  participant W as web
  participant P as postgres
  participant J as Job loop (web)
  Note over P: booking X is held, deadline 14:20
  V->>W: GET /availability at 14:21
  W->>P: active bookings where status is not held, or deadline is in the future
  P-->>W: X not returned
  W-->>V: slot free
  J->>P: at 14:22, mark held bookings past deadline as expired
  Note over J: sweep is housekeeping only
  V->>W: POST /bookings for X's slot
  W->>P: tx: expire overdue hold on range (no-op now), insert
  P-->>W: ok
```

The slot is free at 14:20:00 whether or not the sweep has run, because every read compares the deadline with the clock (ADR-010). The sweep exists so stored status matches reality for the dashboard and reports. If the job loop is down, step 5 never happens and step 7 still succeeds, because hold creation expires the overdue row itself inside its transaction.

## Flow 4: Staff enter a phone booking while an online hold is active

```mermaid
sequenceDiagram
  autonumber
  participant S as Staff
  participant W as web
  participant P as postgres
  Note over P: slot is held online, 12 minutes left
  S->>W: POST /staff/bookings (slot, occasion, customer)
  W->>P: tx: expire overdue hold on range, insert confirmed booking
  P-->>W: exclusion constraint violation
  W-->>S: 409 SLOT_TAKEN with holder status and deadline
  Note over S: wait for expiry, or choose another slot
```

Staff entries go through the same constraint as customer holds; there is no override. The response tells staff who holds the slot and until when, so they can tell a caller "try again in 12 minutes". This is what makes the public calendar the single record of every booking.

## Flow 5: The verification code cannot be delivered

```mermaid
sequenceDiagram
  autonumber
  participant C as Customer
  participant W as web
  participant T as Twilio
  C->>W: POST /verification/request (phone)
  W->>T: send code by WhatsApp
  T--xW: error or timeout
  W->>T: send code by SMS
  T--xW: error or timeout
  W-->>C: 503 CODE_DELIVERY_FAILED with venue phone and WhatsApp
  Note over C: no hold is created
```

When both channels fail, nothing is held (ADR-016). The page shows the venue's phone and WhatsApp so the owner can enter the booking by hand, which then follows flow 4. The calendar can never be filled by unverified numbers, at the price of no online bookings during a messaging outage.

## Failure behavior

| Step that fails | Effect |
|---|---|
| Code send (flow 1, step 3) | Flow 5 |
| Outbox send (flow 2, step 7) | Message stays queued and is retried with backoff; WhatsApp failure falls back to SMS. The booking is unaffected and visible in the review queue |
| File write (flow 2, step 3) | Upload fails with a retry prompt and the WhatsApp button; the hold clock keeps running |
| Sweep (flow 3, step 5) | No user-visible effect |
| `postgres` during any flow | The request fails; the static contact notice is shown |

## Constraints

- No flow keeps a connection open; the calendar and the booking page poll.
- Every status change and its side effects (audit row, outbox row) commit in one transaction, so a message is never queued for a change that did not happen.
- Outbox delivery is at-least-once; templates are safe to receive twice.

## Change cost

**Cheap:** adding a new message to a flow (queue another outbox row); changing who is alerted.

**Expensive:** adding a staff override for the overlap rule; moving code delivery to the outbox (the booking form would have to poll for delivery).

## Decisions

- ADR-010 — Hold expiry by timestamp
- ADR-011 — Verification codes inline, everything else through an outbox
- ADR-013 — Staff alert carries a link, not the image
- ADR-014 — Calendar freshness by 30-second polling
- ADR-016 — A failed verification stops the booking
