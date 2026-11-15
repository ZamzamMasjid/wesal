---
id: ADR-008
type: adr
title: Build the interface from shadcn/ui on Radix
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/project-setup
mirror_id: ""
counterpart_adrs: []
---

# ADR-008: Build the interface from shadcn/ui on Radix

## Context

The design direction is elegant and formal, Arabic-first with right-to-left layout, at WCAG AA. Components must be accessible and fully restylable.

## Decision

Use shadcn/ui components on Radix primitives, with Lucide icons.

## Rationale

Radix supplies accessible behavior (focus management, keyboard support, direction awareness). shadcn/ui copies component source into the project, so the formal look is the project's own and not a stock theme.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Material UI | Complete and RTL-ready, but looks like Google Material unless heavily overridden. |
| Custom components from scratch | Total control, the most work and the most accessibility risk. |

## Consequences

Component source lives in the repository and is maintained there; it is exempt from coverage thresholds. Styling uses Tailwind logical properties throughout.
