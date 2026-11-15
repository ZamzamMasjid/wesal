---
id: ADR-024
type: adr
title: Feed design tokens to the app as CSS variables
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-1-infrastructure/project-setup
mirror_id: ""
counterpart_adrs: []
---

# ADR-024: Feed design tokens to the app as CSS variables

## Context

`docs/design/tokens.css` is the single source for color, type, spacing, radii and shadows, in a light and a dark theme. The approved mockups read it directly. The app is styled with Tailwind and shadcn/ui (ADR-008), which have their own theme mechanism, and it must show the same values or the mockups stop being the visual truth. The type family, Cairo, is not a system font.

## Decision

The app's global stylesheet declares the same custom properties as `tokens.css`, under `:root` and `:root[data-theme="dark"]`. The Tailwind theme and the shadcn/ui color slots point at those variables; they hold no literal color, radius or shadow values of their own. The theme toggle sets `data-theme` on the root element.

A unit test compares the app's token declarations with `docs/design/tokens.css` and fails on any difference.

Cairo is loaded with `next/font/local` from the font file bundled in the repository and exposed as `--font-sans`. The `@font-face` rule in `tokens.css` exists for the mockups only.

## Rationale

Variables keep one set of names from mockup to component, so structure and class rules lift from a mockup with little translation. Dark mode becomes one attribute switch, not a `dark:` variant on every color. shadcn/ui is already built around CSS variables, so this is its native path.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Generate a Tailwind theme with literal values from `tokens.css` | No runtime variables, so dark mode needs a `dark:` variant on every color utility, and a build step must be kept working. |
| Import `docs/design/tokens.css` into the app directly | Couples the build to a file under `docs/` and ships the mockups' `@font-face` path, which is wrong for the app. |
| Load Cairo from Google Fonts at runtime | An extra third-party request on slow phones, and the page would depend on an outside service. |

## Consequences

A token change is made in `tokens.css` first, then copied to the app's stylesheet; the test catches a missed copy. Adding a token means adding it in both places. The font file is served from the app's own origin and adds roughly 600 KB to the repository. It is a variable font, so one file serves every weight.
