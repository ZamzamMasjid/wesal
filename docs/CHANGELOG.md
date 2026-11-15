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
