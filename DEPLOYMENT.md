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

| Secret                                    | Used by              | Value                                                               |
| ----------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`                            | app, release command | `postgres://wesal:<POSTGRES_PASSWORD>@wesal-db.internal:5432/wesal` |
| `BETTER_AUTH_SECRET`                      | staff-access         | `openssl rand -hex 32`                                              |
| `BETTER_AUTH_URL`                         | staff-access         | The public site URL, e.g. `https://wesal.fly.dev`                   |
| `TWILIO_ACCOUNT_SID`                      | message-delivery     | From the Twilio console                                             |
| `TWILIO_AUTH_TOKEN`                       | message-delivery     | From the Twilio console                                             |
| `TWILIO_WHATSAPP_FROM`, `TWILIO_SMS_FROM` | message-delivery     | Sender numbers; the final names are set by that section             |

```bash
fly secrets set -a wesal DATABASE_URL="postgres://wesal:...@wesal-db.internal:5432/wesal" --stage
fly secrets set -a wesal BETTER_AUTH_SECRET="$(openssl rand -hex 32)" --stage
# Twilio values can wait until message-delivery ships; setting them later is fine.
```

`--stage` queues secrets without restarting; they apply on the next deploy. Never commit secrets; `.env*` is git-ignored.

## Deploying

```bash
fly deploy
```

Order (ADR-021): build image, run `node dist/migrate.mjs` on a temporary machine with no volume, and only if it succeeds replace the app machine. A failed migration aborts the deploy and the old version keeps serving. Expect a short outage while the single machine is replaced (ADR-009).

Migrations must not break the version they replace: add in one deploy, remove in a later one.

## Checking a deploy

```bash
curl -s https://<app-url>/api/v1/health
```

Returns `{"ok":true,"data":{"web":"up","database":"up","jobs":{"lastTickAgeSeconds":...}}}`. A `503` with `SERVICE_UNAVAILABLE` means Postgres does not answer. `lastTickAgeSeconds` is `null` until the job loop (message-delivery) ships. Fly's own check uses `?probe=web` so a database outage still shows visitors the fallback notice.

Logs are the only observability (ADR-017):

```bash
fly logs -a wesal
```

## Rehearse a snapshot restore (once, before launch)

ADR-015 requires knowing the procedure before it is needed.

```bash
fly volumes snapshots list <volume-id> -a wesal-db
fly volumes create wesal_pgdata_restore -a wesal-db --region ams --snapshot-id <snapshot-id>
```

Confirm the restored volume mounts and Postgres starts on it (e.g. a throwaway machine), then destroy the restore volume. Record the date here when done.

## Local image check

```bash
docker build -t wesal .
```

## Troubleshooting (seen on the first deploy)

- **`failed to verify certificate: x509` from the Depot builder:** deploy with `fly deploy --depot=false` to use Fly's own remote builder.
- **`insufficient resources ... existing volume`:** the host holding that volume is full. Create a new empty volume of the same name with `fly volumes create wesal_data --require-unique-zone`, destroy the stuck empty one, and deploy again.
- **First health call returns 503 right after a deploy:** the first database connection can exceed the 2-second timeout. Call it again.
