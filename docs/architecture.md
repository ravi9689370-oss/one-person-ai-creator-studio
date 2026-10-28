# Architecture

## Stack

- **Next.js 14 (App Router)** — one app: server components for every page + `src/app/api/**` route handlers. No separate backend service to deploy.
- **TypeScript (strict)** everywhere, including pages.
- **Prisma + SQLite** for local development; **PostgreSQL** is the documented production target (`docs/deployment.md`). Status enumerations are stored as validated strings so a single schema runs on both.
- **next-auth (credentials, JWT)** for session management; per-workspace memberships resolve through `WorkspaceMember`.
- **Tailwind CSS** custom palette with light/dark mode.
- **Vitest** for unit/service/provider tests with an isolated throwaway DB.

## Layers

```
src/
  app/(auth)/          login, register, forgot/reset, onboarding
  app/(app)/           every product page (server components + client forms)
  app/api/             ~40 route handlers (validated with zod; fail structured)
  components/          UI kit (PageShell, Card, DataTable, InlineForm...)
  server/agents/       director.ts (classify/plan/verify), handlers.ts, dispatch.ts, queue/runner.ts
  server/providers/    llm, tts, transcription, image, video adapters (fixture mode)
  server/approvals.ts  approval gates + per-object side effects
  server/integrations.ts  provider status derivation (config detection)
  lib/                 env, db, auth, authz, time (DST-safe), utils, page helpers
```

## Task lifecycle (the heart of the system)

```
intent ──▶ Studio Director classifyIntent() ──▶ AgentTask{queued}
        ──▶ runner claims task{running} ──▶ agent handler uses provider adapter
        ──▶ finalizeTask(status, summary, outputRefs?)
              ├─ outputRefs verified (media:/script:/task: actually exist)
              ├─ status: succeeded | failed | waiting_for_approval
              └─ every state change auditable; isMock flags fixture providers
```

- **`waiting_for_approval` is a real state** — approval gates pause production steps (scripts, voice, videos, publishing).
- Attempt counters (`attempts ≤ maxAttempts`) re-queue transient failures; **failures are preserved with a reason** (e.g. missing platform connection or failed verification).
- Workflow definitions (`content_to_publish`, `dubb_multilang`) spawn steps whose `approval: true` flags create explicit approval requests; the execution status reflects blockers (`waiting_for_approval`).

## Provider honesty contract

Every external interaction flows through `src/server/providers/*`:

| Capability | Real provider | Fixture fallback behavior |
| --- | --- | --- |
| LLM | Anthropic, OpenAI | deterministic template reply, tagged "DEVELOPMENT FIXTURE — DEV" |
| TTS | ElevenLabs | tiny synthetic WAV + `mockNote` "DEVELOPMENT FIXTURE" |
| Transcription | OpenAI Whisper | stub transcript starting "[DEVELOPMENT FIXTURE TRANSCRIPT]" |
| Image | OpenAI Images | SVG placeholder labeled "DEVELOPMENT FIXTURE IMAGE" |
| Video | Higgsfield boundary | **throws** — never fabricates an MP4 |
| Payments | Stripe (`stripe` webhook) | HMAC-verified events only; manual sales labeled `(manual verification)` |

`isMock` columns let every UI list render a "DEV" badge next to fixture outputs.

## Scheduling

- `src/lib/time.ts` computes local wall-clock parts via `Intl` on every evaluation — no cached offsets, so DST transitions resolve correctly. Unit-tested against US/UK spring-forward dates and a midnight rollover in a UTC+5:30 zone.
- Two delivery paths for the morning brief: the in-process scheduler (`npm run scheduler`) and an external cron hitting `/api/cron/morning-brief` with `CRON_SECRET`. Runs are idempotent per workspace+date (`Report @@unique([workspaceId, kind, forDate, timezone])`).

## Storage & media

- Uploads go through PRWM service (`src/server/storage.ts`) writing under a workspace-scoped key; media assets are private by default.
- Serving happens through `/api/media/[id]/raw` which re-checks workspace membership — files are not served from a public CDN by default. See [docs/security.md#storage-media-privacy](security.md#storage-media-privacy).
