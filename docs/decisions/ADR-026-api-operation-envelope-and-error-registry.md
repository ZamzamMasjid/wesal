---
id: ADR-026
type: adr
title: Define operations once, with a fixed result envelope and one error-code registry
last_modified: 2026-11-16
decision_status: Accepted
phase_section: phase-1-infrastructure/project-setup
mirror_id: ""
counterpart_adrs: []
---

# ADR-026: Define operations once, with a fixed result envelope and one error-code registry

## Context

ADR-012 makes every operation a versioned JSON endpoint, and ADR-020 has server-rendered pages call the same operation function in-process. Both need one shape for success and failure, stable error codes the web UI and the later mobile app can map to bilingual text, and a place where the access level is declared. The auth architecture requires that a missing or invalid session always denies and that owner-only endpoints declare their level in the definition. Feature specs already name codes (`SLOT_TAKEN`, `CODE_DELIVERY_FAILED`, `RATE_LIMITED` and others) and a few statuses.

## Decision

An operation is created with `defineOperation({ name, access, input, handler })` in `src/api/`. The returned function checks access first, validates the raw input with zod second, runs the handler, and always returns an `ApiResult`; it never throws. The handler reports expected failures by throwing `ApiError(code, message, details)`; any other exception becomes `INTERNAL` with a generic message, and the real error is logged as one structured line carrying the request id.

The result is an envelope, the same in-process and over HTTP:

- success: `{ "ok": true, "data": … }`
- failure: `{ "ok": false, "error": { "code", "message", "details"?, "requestId" } }`

`src/api/errors.ts` holds the single registry of error codes, each with one fixed HTTP status (validation 422, unauthenticated 401, forbidden 403, not found 404, rate limited and too many attempts 429, slot taken and hold expired 409, file too large 413, delivery failure 503, internal 500). Codes are stable and never renamed. `message` is for developers; users see text their client maps from `code`. Validation failures carry `details.issues` as `{ path, code, message }`.

`route(operation, options)` in `src/api/http.ts` is the thin HTTP wrapper. It builds input from the query string (GET, HEAD, DELETE) or a JSON body (other methods) merged with path parameters, which win. It generates the request id itself, returns it in `x-request-id` and the error body, and sets `cache-control: no-store`. Any `/api/v1` path without a route returns a `NOT_FOUND` envelope. Access levels are `anonymous`, `holder`, `staff` and `owner`; a booking holder is anonymous to the framework and the operation checks the token. `resolveCaller` returns anonymous until staff login exists, so every staff and owner operation denies until then. Operations live in `src/operations/`, routes in `src/app/api/v1/`.

## Rationale

One definition site means validation and authorization cannot be skipped by either caller, which is what ADR-020 requires. Returning a result instead of throwing makes the in-process call and the HTTP call identical and keeps results serializable. A single registry keeps status codes consistent and gives the UI one list to map. Declaring `access` in the definition makes a missing check visible in review and coverable by one table-driven test. Taking the request id from the server, not the client, stops forged log fields.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Throw errors from operations and map them in each route | Pages would need their own try/catch and mapping, and the two paths could drift. |
| Problem Details (RFC 9457) as the error body | A recognised standard, but it carries no discriminant for success and the project's clients need a stable `code`, so a plain envelope is simpler for one client team. |
| Let each route choose its own status for a code | Statuses would drift between endpoints. |
| Check access in the route wrapper | Server renders would bypass it (ADR-020). |

## Consequences

Every endpoint is a `route(operation)` export plus an operation file; unit and integration tests target the operation and the endpoint. Adding an error code is a one-line change but removing or renaming one is a breaking API change once the mobile app ships (ADR-012). Statuses chosen here for codes the specs leave open (`CODE_INVALID`, `CODE_EXPIRED`, `HOLD_EXPIRED`, `INVALID_FILE`) can be revisited before the first client depends on them. Methods a route does not export get Next.js's own empty 405, not the envelope. The staff-access feature must replace `resolveCaller`; until it does the framework fails closed.
