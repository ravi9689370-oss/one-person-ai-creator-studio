# Operations Runbook

## Daily flow

1. **Morning brief** — generated per workspace schedule (`ScheduledReport`, timezone-aware). Deliverables: in-app at `/reports/morning-brief`, optional Slack/email when configured. Metrics show data-quality labels (`REAL / PARTIAL / NO-DATA`).
2. **Director intake** — the creator types intent in `/studio/director`; the task lands in `/studio/tasks` and runs through the agent pipeline.
3. **Production** — scripts (`/scripts`), voice (`/voice-lab`), localization, video, thumbnails progress as `AgentTask` rows; artifacts appear under their respective pages.
4. **Approvals** — `/approvals` shows gated work. Publishing never happens while a gate is open (server-enforced `409 approval_required`).
5. **Distribution** — schedule campaigns in `/distribution`; failures (e.g. `platform_not_connected`) appear in `/distribution/posts` and the queue stays truthful.

## The two queue modes

| Mode | When | Command / behavior |
|------|------|---------------------|
| **Inline drain** | Dev, quick UX | API routes drain tasks for up to 20 s so the UI reflects progress immediately (`drainQueueInline`) |
| **Worker process** | Prod / always | `npm run worker` polls `AgentTask(status=queued)` continuously |
| **Scheduler process** | Prod / always | `npm run scheduler` runs briefs at their scheduled local times (node-cron minute tick, DST-safe via `src/lib/time.ts`) and opportunistically assists the queue |

Keep the worker running in production; the inline drain is best-effort, not a replacement.

## Morning brief scheduling

- **In-app:** set time + timezone in `/settings/briefing` (writes `ScheduledReport`).
- **External cron (optional):**
  ```bash
  curl -X POST https://{host}/api/cron/morning-brief -H "x-cron-secret: $CRON_SECRET"
  ```
  Safe for double-fires: generation is idempotent per workspace+date+timezone.

## Data-quality labels

| Label | Meaning |
|-------|---------|
| `REAL` | Computed from rows in this workspace (e.g. verified payment events) |
| `PARTIAL` | Mixed real + missing data (says what is missing) |
| `NO-DATA` | Nothing to compute; section explains what is needed |

Manual-verified revenue rows are `REAL`-eligible **only** for displaying what the owner asserted — they always carry the `(manual verification)` label so they are never confused with provider-verified Stripe events.

## Recording a manual sale

1. `/monetization` → manual sale form (client component `manual-sale.tsx`).
2. Type the order details; the row is linked and labeled at entry.
3. Under the hood: `PaymentEvent(kind="owner.manual_verified", signatureVerified=false)` + revenue ledger line tagged `(manual verification)`.
4. If Stripe later confirms the same purchase through a verified webhook, you keep both rows distinct — append, never overwrite.

## Expected behaviors that look like errors (but are correct)

| Symptom | Why | Action |
|---------|-----|--------|
| Publish → `platform_not_connected` | You have not connected the platform's OAuth app. System fails closed. | Connect in `/distribution/accounts` (docs: [integrations.md](integrations.md)) |
| Delete an approved script → `409 delete_by_version` | Approved versions are archived, never deleted (audit trail) | Supersede with a new version; archive manually |
| Script generation output feels canned ; DEV badge on video/voice/thumbnail artifacts | Providers are in fixture mode (`isMock`) | Configure real keys — statuses turn `configured` on `/integrations` |
| Video task `failed` with "never fabricates" error | Intentional: mock adapter refuses to invent an MP4 | Provide a render provider or use the exported assemble plan in a real editor |

## Adding real API keys later

1. Set env vars on the host (full list: [integrations.md](integrations.md#full-environment-variable-reference)).
2. Restart the app (env values are read per-process).
3. Open `/integrations` → statuses re-derive (`configured`/`awaiting_authorization`) with `unverified` capabilities.
4. Exercise each provider once (a script generate, a TTS job, a test webhook…) → `lastSuccessAt` proves the link.

## Backups & restore

- **Data:** periodic copy/backup of the SQLite file (`prisma/creator-studio.db`) or Postgres snapshots.
- **Media:** back up `.storage/` (uploads) alongside the DB — artifact references point to media rows there.
- **Secrets:** keep `.env` in your secret store (it is never committed).

## Reset dev environment

```bash
rm -f prisma/*.db .storage -r
npm run db:migrate && npm run db:seed
```

## Runbook table

| Symptom | Check | Fix |
|---------|-------|-----|
| Brief missing this morning | `ScheduledReport.lastRunForDate` + scheduler process alive? | start `npm run scheduler`, or hit the cron endpoint manually; brief back-fills on next tick |
| Tasks stuck in `queued` | worker process running? | `npm run worker`; inline drain covers UI usage meanwhile |
| Task `waiting_for_approval` | decision pending | decide in `/approvals`; pipeline resumes after |
| 429s on API | rate limiter | expected under bursts; scale guidance in [deployment.md#scale-notes](deployment.md#scale-notes) |
| Uploads 404 | `.storage/` volume present? | restore volume / re-mount disk |
| Stripe test event rejected | `STRIPE_WEBHOOK_SECRET` matches the endpoint config | rotate together; unverified events are always rejected |
