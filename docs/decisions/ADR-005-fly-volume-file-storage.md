---
id: ADR-005
type: adr
title: Store files on a Fly volume; keep payment screenshots one day
last_modified: 2026-11-21
decision_status: Accepted
phase_section: phase-1-infrastructure/deployment
mirror_id: ""
counterpart_adrs: []
---

# ADR-005: Store files on a Fly volume; keep payment screenshots one day

## Context

The system stores two kinds of files: venue photos and videos, and payment screenshots uploaded by customers. The user stated that a screenshot is only needed for a day: once the day ends there is no need to keep it, and the owner saves any he wants elsewhere.

## Decision

Store all files on a Fly volume attached to the app machine, the same pattern as the user's other project. Purge payment screenshot files daily once they are a day old and their booking is no longer awaiting review; keep the database row. Venue media persists.

## Rationale

It is the simplest option and one the developer already operates. A one-day life for screenshots keeps personal financial images off the server and keeps the volume small.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Tigris object storage on Fly | Files would survive redeploys and a second machine and be served from near the visitor, but it is another service to set up; it was the recommendation and the user chose the volume. |
| Cloudflare R2 | Same benefits as Tigris with free downloads, on a separate account. |

## Consequences

A Fly volume attaches to one machine, so the app runs as exactly one machine and deploys have brief downtime (ADR-009). Videos stream through the app process from Amsterdam. Moving to object storage later is the prerequisite for a second machine. The purge never deletes a proof still awaiting review; such a file is purged on the first daily run after staff decide (confirmed by the owner).
