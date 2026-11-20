<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git workflow (always — do not wait to be asked)

- **Stage every file that belongs to the work.** After creating or editing files, run `git add` on them (or `git add -A`) so no new source, test, migration, or doc file is left untracked in the IDE. Never leave work as "unversioned files".
- **Never stage noise.** Leave ignored files (`.env*`, `*.tsbuildinfo`) and unrelated IDE changes (`.idea/*`) out of the commit unless the task is specifically about them.
- **Commit when a section is complete.** The moment an `axiom:section` run is done — code, tests, roadmap checkboxes, manifests/INDEX, and sync/reindex all finished and green — create the commit yourself. Do not ask the user whether to commit, and do not wait for them to say "commit". Do not push unless asked.
- **Run the checks first.** Typecheck, lint, and the affected unit + integration tests must pass before the commit. Fix the code; never weaken or delete tests to make them pass.
- **One commit per completed section** (or per stand-alone fix/change), not one per file.

### Commit message convention

For a roadmap section, always use this shape:

```text
<type>: <phase-id>, section <section-slug>:

- <change, sentence case, no trailing period>
- <change>
- <migrations, ADRs, spec status, or "ship the feature" notes>
```

- `<type>` is the conventional commit type: `feat` (new behavior), `fix` (bug), `docs` (docs only), `test` (tests only), `refactor` (no behavior change), `chore` (tooling/config).
- The subject line is exactly `<type>: <phase-id>, section <section-slug>:` — lowercase, no period.
- The body is a `-` bullet list of the meaningful changes, one per line: endpoints, tables/migrations, UI, tests, docs, and the feature/phase status change.
- Work outside a section uses `<type>: <short imperative summary>` plus the same bullet body when useful.

Example:

```text
feat: phase-3-booking, section booking-hold:

- Add the no-overlap exclusion constraint in migration 0009
- Add POST /api/v1/bookings with verified phone, near-slot cutoff and urgent flag
- Add the booking form with conflict panel and the hold sweep job
- Add bilingual strings and unit/integration tests; mark the section done
```
