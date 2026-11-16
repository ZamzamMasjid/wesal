---
id: ADR-025
type: adr
title: Use next-intl for locale routing and message catalogs
last_modified: 2026-11-16
decision_status: Accepted
phase_section: phase-1-infrastructure/project-setup
mirror_id: ""
counterpart_adrs: []
---

# ADR-025: Use next-intl for locale routing and message catalogs

## Context

Arabic (right-to-left) is the default and English is fully supported; every user-facing string, including WhatsApp and SMS templates, exists in both. The landing-page spec fixes the URLs: `/` is Arabic, `/en` is English, each with `hreflang` links. Arabic has six plural forms, and customer-facing text such as countdowns and slot counts needs them. Next.js offers a built-in pattern (a proxy plus JSON dictionaries read through `next/root-params`) and leaves plurals, formatting and client-component messages to the app.

## Decision

Use next-intl. Locales are `ar` (default, no URL prefix) and `en` (prefix `/en`), set with `localePrefix: "as-needed"`. Locale detection and the locale cookie are off, so `/` is always Arabic and no cookie is set for language; English is reached by the language switch. The `proxy.ts` matcher excludes `/api`, because the JSON API under `/api/v1` is not localized. The root layout lives at `src/app/[locale]/layout.tsx` and sets `lang` and `dir` from the locale. Message catalogs are `messages/ar.json` and `messages/en.json`, with Arabic as the source catalog for message-key types.

A compile-time check (`src/i18n/catalog-parity.ts`) fails `npm run typecheck` when the two catalogs do not have exactly the same keys.

## Rationale

ICU messages give correct Arabic plurals and number and date formatting, with one API in server and client components. It is the established library for exactly this routing shape. Turning detection off follows the spec (Arabic by default, English on request) and avoids a redirect that would send an English-browser visitor away from the canonical Arabic page. Checking key parity in the type system makes the "every string in both languages" rule part of the gate CI already runs, with no runtime code.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Next.js built-in dictionaries with a hand-written proxy | No dependency, but plural rules, formatting and passing messages to client components would be hand-written and maintained. |
| Prefix every locale (`/ar`, `/en`) | Simpler routing, but contradicts the landing-page spec (`GET /` is the Arabic page) and splits the canonical URL. |
| Detect language from `Accept-Language` | Convenient for English visitors, but makes `/` return different pages and conflicts with Arabic as the canonical default. |

## Consequences

Links must use the locale-aware `Link` and `redirect` from `src/i18n/navigation.ts`, not those from `next/link` and `next/navigation`. A route that must not be localized (the API, later the dashboard if it is given its own language handling) has to be excluded in the `proxy.ts` matcher. A URL that matches no route renders the localized not-found page only after the client hydrates, because with the root layout under a dynamic segment the server sends the generic error shell with a correct 404 status; the experimental `global-not-found` file was not adopted since it cannot know the visitor's locale. Two transitive dependencies pulled in for next-intl's message extractor (`@parcel/watcher`, `@swc/core`) have install scripts that are left unapproved, since the extractor is not used.
