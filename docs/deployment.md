# Deployment Guide

## Overview

One Next.js app serves both pages and API routes. Two optional long-running processes (`npm run worker`, `npm run scheduler`) plus one external-cron option. Default datastore is SQLite; Postgres is a config switch.

```
Creator
  ├─ web app  (Next.js 14, pages + API, single app)
  ├─ worker   (npm run worker  — drains agent task queue)
  ├─ scheduler(npm run scheduler — morning briefs + queue assist; or external cron)
  └─ SQLite file under prisma/  →  (switch) Postgres
```

## Requirements

- Node **>= 20** (`engines` in `package.json`)
- A project directory writable by the app (for `.storage/` uploads and the SQLite file)
- For Android: Java 17 + Android SDK — [android-build.md](android-build.md)

## Environment variables (minimum)

| Key | Example | Purpose |
|-----|---------|---------|
| `DATABASE_URL` | `file:./creator-studio.db` | SQLite is relative to `prisma/schema.prisma` |
| `NEXTAUTH_SECRET` | long random | session signing |
| `NEXTAUTH_URL` | `https://studio.yourdomain.com` | absolute origin |
| `CRON_SECRET` | long random | gates `/api/cron/morning-brief` |

Verified reproducible: `next build` succeeds with **only** the four values above (plus `prisma migrate deploy` first).

### Optional provider keys

See the full table in [integrations.md](integrations.md#full-environment-variable-reference). Every provider is optional; unconfigured ones show `awaiting_credentials` and use labeled dev fixtures.

## Steps

```bash
# 1. install (generates the Prisma client via postinstall)
npm ci

# 2. create / migrate the database schema
npm run db:migrate          # prisma migrate deploy

# 3. (first run / demo) seed the workspace + creator
npm run db:seed
#    dev login: SEED_CREATOR_EMAIL / SEED_CREATOR_PASSWORD from .env

# 4. build
npm run build

# 5. run
npm run start               # web app    (port 3000)
npm run worker              # foreground queue drain (separate process)
npm run scheduler           # scheduled reports, checks every minute
```

## Switching SQLite → Postgres

1. Edit `prisma/schema.prisma`:

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

2. Set `DATABASE_URL` to the Postgres connection string.
3. Rebaseline migrations:

```bash
rm -rf prisma/migrations
npx prisma migrate dev --name init
```

(Workspace data is dev-local; we prioritize a clean Postgres baseline over migrating fixture rows. Re-seed afterwards.) No schema changes are needed — the model already uses string status columns and integer ids that map cleanly to Postgres.

## Scale notes

- **Rate limiter** (`src/server/api.ts`) is in-process: behind multiple app instances its buckets are per-instance. Fine for a solo-creator scale; for multi-instance, front the API with a shared limiter or move buckets to Redis/Postgres.
- **Worker & scheduler** assume one instance each. Running multiple schedulers is *safe by design* (brief generation is idempotent per workspace+date via `Report @@unique` + `lastRunForDate`), but a single scheduler is cleaner.
- **Inline queue drain:** API routes can drain small task batches inline (bounded 20 s) for immediate feedback even without a worker process.
- **Uploads**: `.storage/` must be on a persistent-volume disk (e.g. mounted volume / EFS) — or replace `src/server/storage.ts` with an S3/GCS adapter (single-file change).

## Cron option (instead of the scheduler process)

Point any external scheduler at:

```
POST {NEXTAUTH_URL}/api/cron/morning-brief
x-cron-secret: <CRON_SECRET>
```

Runs are idempotent per workspace + date + timezone, so calling twice in a day will not duplicate briefs. GitHub Actions, Vercel Cron or system cron all work.

## Health checks & smoke test

After deploy:

1. `GET {NEXTAUTH_URL}/api/integrations` → 200 with the registry, `local_storage` `operational`.
2. `/login` with the seeded creator → dashboard loads.
3. Post a director intent in **/studio/director** → a task lands in **/studio/tasks** and completes (fixture agents).
4. **/reports/morning-brief** → a brief renders with REAL/PARTIAL/NO-DATA labels.

## Rollback

- Keep the previous `.next` build (`npm run build` outputs atomically; `next start` uses the last complete build).
- Schema changes ship as migrations; `npm run db:migrate` is forward-only — restore the DB binary or volume snapshot to roll back data.

## Android APK

`.github/workflows/android.yml` builds `app-debug.apk` on demand. Configure the app's server URL at build time with `CREATOR_STUDIO_SERVER_URL` (default `http://10.0.2.2:3000` for the emulator). Full instructions: [android-build.md](android-build.md).
