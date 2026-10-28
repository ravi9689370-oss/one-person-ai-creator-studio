# The One-Person AI Creator Studio

A complete, production-oriented SaaS platform for a **single creator running an entire content business with an AI team** — from planning to script, voice, video, localization, distribution, AI sales ("AI Maya"), CRM, monetization, and a morning executive brief.

Backed by a 13-agent studio (Studio Director + specialized agents), real verification gates, honest failure modes, and a verified-audit-trail-by-default design.

## What is included

| Module | Highlights |
| --- | --- |
| **Studio Director** | Plain-language intent intake → deterministic classification → routed agent task → verified outputs → workflow orchestration with approval gates |
| **Agents** | research, strategy, script, voice, localization, video, thumbnail, repurpose, distribution, analytics, quality, sales (Maya), brief — all registered per workspace with status + last-run tracking |
| **Creator Input** | Brand profile (+personas), style guides, knowledge base (chunked), media library (authenticated storage), topics backlog, voice notes, DST-safe content calendar |
| **Production** | Scripts (versioned), Voice Lab, Localization (translate → human review → dub/burn), Video Studio, Thumbnails (A/B experiments), Repurposing (clip candidates→verified), Approvals (human-in-the-loop) |
| **Distribution & Business** | Social accounts (provider-verified only), publishing queue (fail-closed), published posts + metrics provenance, AI Maya (always identifies as AI), CRM pipeline, Monetization (provider-verified payments), Brand deals |
| **Analytics & Reports** | Content/revenue/conversion analytics (snapshot-based), morning brief with REAL / PARTIAL / NO-DATA data-quality labels |
| **Platform** | Integration status derived from real configuration detection, audit log, notifications, global search |

## Getting started (local development)

```bash
npm install
cp .env.example .env.local   # fill in NEXTAUTH_SECRET, SEED_* values
npx prisma migrate dev       # applies the schema (SQLite)
npm run seed                 # creates creator@example.com + fixture-labeled workspace
npm run dev                  # web app on http://localhost:3000
```

Optional durable background workers:

```bash
npm run worker    # drains the durable agent-task queue
npm run scheduler # fires scheduled reports (e.g. 07:00 morning brief, timezone-aware)
```

Log in with the bootstrap account from your `.env.local` (`SEED_CREATOR_EMAIL`).

## Development-fixture mode (no API keys required)

Without provider credentials the app is fully functional against **clearly-labeled development fixtures**:

- Every mock-provider output is labeled `DEVELOPMENT FIXTURE` in UI and text (`isMock` flags in the DB).
- The mock video adapter **intentionally cannot produce an MP4** — renders fail visibly instead of fabricating a file.
- Publish attempts when a platform is not provider-verified fail **closed** with `platform_not_connected`.
- Manual sales are recorded as `(manual verification)` and never conflated with provider-verified payments.

Never present fixture output as real data: see `docs/security.md`.

## Testing

```bash
npm test       # vitest unit/service/provider tests against an isolated test DB
npm run build  # full production build + type-check of all pages
```

## Documentation

- `docs/architecture.md` — system design, agent pipeline, task semantics
- `docs/requirements-traceability.md` — requirement → implementation → test evidence
- `docs/integrations.md` — provider matrix & status semantics
- `docs/security.md` — data integrity, approvals, secrets
- `docs/deployment.md` — Postgres migration & hosting
- `docs/operations.md` — runbook (workers, cron, backups)
- `docs/android-build.md` — standalone offline-first Android app (full SPA bundled in the APK; optional server sync; branded launcher icons, splash + Play Store icon generated in-repo)

## License

MIT.
