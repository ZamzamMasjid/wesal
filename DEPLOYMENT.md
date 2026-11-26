# Deploying Wesal

Production is the only deployed environment (ADR-023): Fly.io, region `ams`, two apps.

| App        | Config        | What it is                                                        |
| ---------- | ------------- | ----------------------------------------------------------------- |
| `wesal`    | `fly.toml`    | The Next.js app, always on, one machine, upload volume at `/data` |
| `wesal-db` | `fly.db.toml` | Self-run Postgres 17, own volume, private network only            |

The app reaches the database at `wesal-db.internal:5432`. The first time anything runs on Fly it runs in production, so do the one-time setup in order.

## One-time setup

Prerequisite: [`flyctl`](https://fly.io/docs/flyctl/install/) installed and `fly auth login` done.

### 1. Database machine and volume

```bash
fly apps create wesal-db
fly volumes create wesal_pgdata -a wesal-db --region ams --size 3 --snapshot-retention 7
fly secrets set -a wesal-db POSTGRES_PASSWORD="$(openssl rand -hex 24)" --stage
fly deploy -c fly.db.toml --ha=false
```

Keep the generated password: step 3 needs it. Fly snapshots the volume daily; `--snapshot-retention 7` keeps a week (ADR-015). Check with `fly volumes snapshots list <volume-id> -a wesal-db`.

### 2. App and upload volume

Fill in `NEXT_PUBLIC_VENUE_PHONE` and `NEXT_PUBLIC_VENUE_WHATSAPP` under `[build.args]` in `fly.toml` (the fallback notice shows them when the database is down).

```bash
fly apps create wesal
fly volumes create wesal_data -a wesal --region ams --size 3
```

The `media` and `proofs` directories under `/data` are created on every start by `docker-entrypoint.sh`.

### 3. Secrets

| Secret                                                                 | Used by              | Value                                                                               |
| ---------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                         | app, release command | `postgres://wesal:<POSTGRES_PASSWORD>@wesal-db.internal:5432/wesal`                 |
| `BETTER_AUTH_SECRET`                                                   | staff-access         | `openssl rand -hex 32`                                                              |
| `BETTER_AUTH_URL`                                                      | staff-access         | The public site URL, e.g. `https://wesal.fly.dev`                                   |
| `TWILIO_ACCOUNT_SID`                                                   | message-delivery     | From the Twilio console                                                             |
| `TWILIO_AUTH_TOKEN`                                                    | message-delivery     | From the Twilio console                                                             |
| `TWILIO_WHATSAPP_FROM`, `TWILIO_SMS_FROM`                              | message-delivery     | WhatsApp sender (e.g. `+14155238886`, the sandbox) and SMS sender                   |
| `MESSAGING_PROVIDER`                                                   | message-delivery     | `twilio` or `whatsend`; without it messages are only logged and none are sent       |
| `WHATSEND_WORKER_URL`, `WHATSEND_WORKER_SECRET`, `WHATSEND_SESSION_ID` | message-delivery     | With `whatsend`: the WhatSend worker address, its secret, and the linked session id |
| `PUBLIC_BASE_URL`                                                      | message-delivery     | Optional; the public origin for the status webhook (defaults to `BETTER_AUTH_URL`)  |

```bash
fly secrets set -a wesal DATABASE_URL="postgres://wesal:...@wesal-db.internal:5432/wesal" --stage
fly secrets set -a wesal BETTER_AUTH_SECRET="$(openssl rand -hex 32)" --stage
# Twilio values and MESSAGING_PROVIDER=twilio can be set when you are ready to send; point Twilio's status callback at <site>/api/v1/webhooks/twilio/status.
```

`--stage` queues secrets without restarting; they apply on the next deploy. Never commit secrets; `.env*` is git-ignored.

### 4. WhatsApp worker (only with `MESSAGING_PROVIDER=whatsend`, ADR-031)

A third app, `wesal-worker`, holds the live WhatsApp connection. It has no public address; the app reaches it at `http://wesal-worker.internal:3001`. Its files live in the WhatSend project (`whatsend/whatsapp-worker`: `Dockerfile`, `fly.toml`).

```bash
cd <whatsend>/whatsapp-worker
fly apps create wesal-worker
fly volumes create wesal_worker_data -a wesal-worker --region ams --size 1
SECRET="$(openssl rand -hex 32)"
fly secrets set -a wesal-worker WHATSAPP_WORKER_SECRET="$SECRET" WHATSAPP_STORAGE_KEY="$(openssl rand -hex 32)" --stage
fly deploy
fly secrets set -a wesal MESSAGING_PROVIDER=whatsend WHATSEND_WORKER_URL=http://wesal-worker.internal:3001 WHATSEND_WORKER_SECRET="$SECRET" WHATSEND_SESSION_ID="$(uuidgen)" --stage
```

Keep `WHATSAPP_STORAGE_KEY` in a password manager: without it the saved session cannot be read and the QR code must be scanned again. Back up the `wesal_worker_data` volume like the others.

Link the venue phone once, from your computer, through a private tunnel (use the session id you set above):

```bash
fly proxy 3001:3001 -a wesal-worker
curl -X POST -H "Authorization: Bearer $SECRET" http://localhost:3001/api/v1/sessions/<session-id>/connect
curl -H "Authorization: Bearer $SECRET" http://localhost:3001/api/v1/sessions/<session-id>/qr
```

The QR response holds `png_base64` (a PNG image, valid for 45 seconds): decode it to a file, open it, and scan it in WhatsApp → Linked devices. `GET .../status` shows `connected` when it worked. Use a dedicated venue number. Then deploy `wesal` so it picks up the secrets.

## Deploying

```bash
fly deploy
```

Order (ADR-021): build image, run `node dist/migrate.mjs` on a temporary machine with no volume, and only if it succeeds replace the app machine. A failed migration aborts the deploy and the old version keeps serving. Expect a short outage while the single machine is replaced (ADR-009).

Migrations must not break the version they replace: add in one deploy, remove in a later one.

## Creating the first owner (once)

There is no sign-up, so a fresh production database has nobody who can log in. After the first deploy that includes staff login, create the owner from the running machine:

```bash
fly ssh console -a wesal -t -C "node dist/create-owner.mjs --username owner --name Owner"
```

It asks for the password at a hidden prompt (minimum 8 characters); the password is never an argument, so it stays out of shell history. It refuses if an active owner already exists, so it cannot create a second one. The owner then adds staff from the dashboard. Locally, `npm run owner:create -- --username owner --name Owner` does the same; `npm run db:seed` creates a dev owner with a known password and must never run against production.

## Importing the venue photographs (once)

The image carries the curated set from `assets/venue` and its order in `scripts/venue-media.json`. The import refuses to run when the library already has media, so it can never overwrite the owner's uploads. On a fresh database:

```bash
fly machine list -a wesal --json
fly machine exec <machine-id> -a wesal "sh -c 'cd /app && su-exec node node dist/import-venue-media.mjs'"
```

The first photo in the manifest becomes the hero. To replace an existing library deliberately, run the same command with `--replace`; that deletes the current media rows and files first. Afterwards `curl -s https://<app-url>/api/v1/content` lists the photographs. The owner can also reorder or replace them in the dashboard media editor.

## Seeding the opening occasions and weekly pattern (once)

The same image carries the sample occasions and weekly slot pattern from `src/db/venue-data.ts`. The sync inserts only into empty tables, so it never overwrites an owner's prices or schedule:

```bash
fly machine exec <machine-id> -a wesal "sh -c 'cd /app && su-exec node node dist/sync-venue-data.mjs'"
```

Verify with `curl -s https://<app-url>/api/v1/occasions`; the calendar then has slots for the week. This script never creates a staff login — use `dist/create-owner.mjs` for the first owner.

## Checking a deploy

```bash
curl -s https://<app-url>/api/v1/health
```

Returns `{"ok":true,"data":{"web":"up","database":"up","jobs":{"lastTickAgeSeconds":...},"messaging":{...}}}`. A `503` with `SERVICE_UNAVAILABLE` means Postgres does not answer. `lastTickAgeSeconds` is `null` until the loop records its first tick. With `MESSAGING_PROVIDER=whatsend`, `messaging` is `{"provider":"whatsend","session":"linked"|"unlinked"|"unknown"}`; `unlinked` means the worker is up but the QR link is gone, and `unknown` means the worker could not be reached or is misconfigured. Both are warnings, not a failed health check, so Fly does not restart a healthy app. Fly's own check uses `?probe=web` so a database outage still shows visitors the fallback notice and the deploy check never waits on the worker.

Logs are the only observability (ADR-017):

```bash
fly logs -a wesal
```

## Rehearse a snapshot restore (once, before launch)

ADR-015 requires knowing the procedure before it is needed.

```bash
fly volumes snapshots list <volume-id> -a wesal-db
# Fly schedules the first snapshot only after a day; to test sooner, take one:
fly volumes snapshots create <volume-id> -a wesal-db
# The restore volume must be at least as large as the snapshot (3 GB).
fly volumes create wesal_pgdata_restore -a wesal-db --region ams --size 3 --snapshot-id <snapshot-id>
fly machine run postgres:17-alpine -a wesal-db --region ams --name restore-check \
  -v <restore-volume-id>:/var/lib/postgresql/data \
  -e PGDATA=/var/lib/postgresql/data/pgdata -e POSTGRES_USER=wesal -e POSTGRES_DB=wesal \
  --vm-size shared-cpu-1x --vm-memory 512
fly ssh console -a wesal-db --machine <machine-id> -C "psql -U wesal -d wesal -c 'select count(*) from drizzle.__drizzle_migrations'"
fly machine destroy <machine-id> -a wesal-db --force
fly volumes destroy <restore-volume-id> -a wesal-db
```

On Windows Git Bash, run these with `MSYS_NO_PATHCONV=1`, or the `/var/lib/...` arguments are rewritten into Windows paths. Postgres then ignores the restored data and initializes an empty database, which looks like a failed restore.

**Rehearsed 2026-11-16:** restored an on-demand snapshot to a new volume and started Postgres on it. It recovered from the write-ahead log and held the migration record and the `btree_gist` extension. Restoring to a new volume and pointing the app at it is the recovery path; remember the app reaches the database at `wesal-db.internal`, so a replacement machine must keep that app name.

## Local image check

```bash
docker build -t wesal .
```

## Troubleshooting (seen on the first deploy)

- **`failed to verify certificate: x509` from the Depot builder:** deploy with `fly deploy --depot=false` to use Fly's own remote builder.
- **`insufficient resources ... existing volume`:** the host holding that volume is full. Create a new empty volume of the same name with `fly volumes create wesal_data --require-unique-zone`, destroy the stuck empty one, and deploy again.
- **First health call returns 503 right after a deploy:** the first database connection can exceed the 2-second timeout. Call it again.
