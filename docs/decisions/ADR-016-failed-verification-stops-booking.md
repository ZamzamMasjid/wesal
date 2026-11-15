---
id: ADR-016
type: adr
title: A verification code that cannot be delivered stops the booking
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-2-foundations/phone-verification
mirror_id: ""
counterpart_adrs: []
---

# ADR-016: A verification code that cannot be delivered stops the booking

## Context

A hold requires a verified phone. The messaging provider can be down, or both WhatsApp and SMS can fail for a number.

## Decision

If the code cannot be delivered on either channel, no hold is created. The page shows the venue's phone and WhatsApp so the owner can enter the booking by hand.

## Rationale

The calendar can never be filled by unverified numbers, including during an outage, which is exactly when an unverified path would be easiest to abuse.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Allow an unverified hold, flagged for the owner | Bookings keep flowing during an outage, but protection against fake holds is off exactly then. |

## Consequences

There are no online bookings while messaging is down; the phone path covers it and goes through manual entry. The failure message must be clear and bilingual.
