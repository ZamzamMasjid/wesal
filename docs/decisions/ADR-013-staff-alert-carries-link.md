---
id: ADR-013
type: adr
title: Staff alerts carry a link, not the screenshot
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-4-operations/staff-notifications
mirror_id: ""
counterpart_adrs: []
---

# ADR-013: Staff alerts carry a link, not the screenshot

## Context

When a customer uploads a payment screenshot, the owner and staff are alerted by WhatsApp. The alert could include the image itself or point to it.

## Decision

The alert contains the booking summary and a link that opens that booking's review page after dashboard login. The image is never attached.

## Rationale

The screenshot never leaves the server: it gets no public URL and no copy in a chat history. Review and decision happen on one screen behind login.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Attach the screenshot in WhatsApp | Fastest to glance at, but the provider must fetch the image from a temporary public URL and a copy then lives in WhatsApp. |

## Consequences

One extra tap, and the reviewer must be logged in on their phone. The deep link must survive the login redirect. Screenshots are served only by a staff-guarded endpoint.
