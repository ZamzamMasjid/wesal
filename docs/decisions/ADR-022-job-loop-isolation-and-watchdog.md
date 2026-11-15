---
id: ADR-022
type: adr
title: Isolate job runs and restart the process when the job loop stalls
last_modified: 2026-11-15
decision_status: Accepted
phase_section: phase-2-foundations/message-delivery
mirror_id: ""
counterpart_adrs: []
---

# ADR-022: Isolate job runs and restart the process when the job loop stalls

## Context

The outbox sender, the hold sweep and the screenshot purge run in a loop inside the web process (ADR-009), and production is observed through logs only (ADR-017). Nothing stated what happens when a job throws or the loop stops ticking while the site keeps serving. In that state booking links and staff alerts would silently stop.

## Decision

Each job run is caught, logged and time-limited, so one bad run never ends the loop. The loop records the time of each tick. When the last tick is too old the process is restarted, and the health endpoint reports the age of the last tick.

The restart is done by a watchdog timer inside the process that exits non-zero, relying on Fly's restart policy. This mechanism was chosen during authoring because a failing Fly health check is not relied on to restart a machine; confirm the behavior when the deployment section is built.

## Rationale

With nobody watching logs, a stalled loop has to heal itself. Restarting the whole site for some seconds is acceptable (short outages are an accepted constraint) and holds stay correct during it because expiry is by timestamp (ADR-010).

## Alternatives considered

| Alternative | Why not |
|---|---|
| Isolate each run only; health reports the web server alone | The site is never restarted because of jobs, but a truly stuck loop stays stuck until someone reads the logs. |
| Exit the process on any job error | Simplest to reason about, but one poison message could restart the site repeatedly. |

## Consequences

The loop needs a staleness threshold comfortably longer than its longest legitimate run, and every job run needs a time limit shorter than that threshold. A watchdog in the same process cannot fire if the event loop itself is blocked; that case shows as a failing health endpoint and is not self-healing. The health endpoint is specified in phase 1 but the loop it reports on is built in phase 2.
