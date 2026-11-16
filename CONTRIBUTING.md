# Contributing to Wesal

## Testing

**[docs/architecture/testing.md](docs/architecture/testing.md) is the source of truth** for how this project tests its behavior: the pyramid, tooling, file layout and naming, coverage targets and CI gating. Read it before writing tests; if this note and that document disagree, that document wins.

Day to day:

```bash
npm run db:up       # start the local Postgres (integration tests need it)
npm test            # unit + integration (Vitest)
npm run test:unit   # unit only
npm run test:int    # integration only (*.int.test.ts, real Postgres)
npm run coverage    # tests with coverage; fails under 80% lines / 70% branches
npm run test:e2e    # Playwright (builds the app and starts it on :3100)
```

Test helpers (factories, database helper, fake clock, fake sender) live in `src/test/`. Every test starts with a `// SPEC:` and `// ROADMAP:` header tracing it to its requirement.

## Before opening a PR

CI runs `npm run lint`, `format:check`, `typecheck`, `coverage` and `test:e2e`. Run the same locally; a failure or a coverage drop blocks the merge.
