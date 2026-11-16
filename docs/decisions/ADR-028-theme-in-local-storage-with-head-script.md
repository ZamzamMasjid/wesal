---
id: ADR-028
type: adr
title: Remember the theme in local storage and apply it with a script in the page head
last_modified: 2026-11-16
decision_status: Accepted
phase_section: phase-1-infrastructure/project-setup
mirror_id: ""
counterpart_adrs: []
---

# ADR-028: Remember the theme in local storage and apply it with a script in the page head

## Context

The design system makes light the default and dark an optional toggle, applied as `data-theme` on the root element (ADR-024). The choice must survive reloads and navigation between the Arabic and English pages, and a returning dark-mode visitor must not see a flash of the light theme. The public pages are statically rendered, so the server does not know who is asking.

## Decision

The choice is stored in the browser's `localStorage` under `wesal-theme` as `"light"` or `"dark"`. A small blocking inline script in `<head>` reads it before first paint and sets `data-theme` on `<html>`; the script and its parser live in `src/lib/theme.ts`. Anything other than a stored `"dark"` means light, and unavailable storage (private mode) means light, with the toggle still working for the visit. The operating system's colour preference is not followed. The toggle (`src/components/theme-toggle.tsx`) is a client component that follows the applied theme through `useSyncExternalStore`, listens for the `storage` event so other tabs stay in step, and renders light on the server and corrects after hydration. `<html>` carries `suppressHydrationWarning` because the script changes `data-theme` before React hydrates. The same toggle serves the public site and, later, the dashboard.

## Rationale

`localStorage` keeps every page static: reading a cookie in the root layout would make every route dynamic and cost a server render on a small machine for a cosmetic preference. It also sets no cookie, so there is nothing to disclose or consent to. A head script is the only way to apply the theme before first paint without server knowledge. Ignoring the OS preference follows the design direction, which treats light as the venue's calm default and dark as a deliberate choice.

## Alternatives considered

| Alternative | Why not |
|---|---|
| A cookie read on the server | No flash and no script, but the root layout reads cookies, which forces every page to render per request. |
| Follow `prefers-color-scheme` automatically | Contradicts "light is the default; dark is an optional toggle" and would surprise visitors whose phones are set to dark. |
| The `next-themes` library | Does the same job; the logic here is about thirty lines and avoids a dependency and its React 19 script-tag handling. |

## Consequences

The first paint is correct for returning visitors but the server HTML is always light, so a visitor with JavaScript disabled always sees light, which is the default anyway. The toggle's icon and label settle one render after hydration. Any future inline script needs a content-security policy nonce if a policy is added. The stored value is per browser, not per account.
