# Requirements Traceability Matrix

**Basis of implementation:** The product PRD PDF was not present on disk at build time. This platform was implemented against the product specification supplied in the build brief (routes, agents, modules and acceptance criteria), and this document maps every major requirement to the code that implements it and the evidence that verifies it.

**Status legend**

- **Shipped** — implemented and verified (unit test, build or live smoke run)
- **Fixture-mode** — implemented; provider runs on a development fixture because real credentials were not supplied
- **Manual** — implemented as a documented human workflow (no feasible public API)

**Evidence legend**

- `UT:<file>` — `tests/unit/<file>` (9 files, 31 tests, all green)
- `BUILD` — `npx tsc --noEmit` and `next build` both pass
- `SMK` — live smoke run against `next start` (login, task intake + drain, approval gate, fail-closed publish, morning brief)
- `CI` — `.github/workflows/ci.yml` runs the build + test suite on every push

---

## 1. Platform architecture

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| A-1 | Next.js App Router monolith: UI + API in one app | `next@~14.2.15`, 44 pages, 44 API routes | `BUILD`, `CI` |
| A-2 | TypeScript strict mode | `tsconfig.json` `strict: true`; clean `tsc --noEmit` | `BUILD` |
| A-3 | Tailwind light/dark theming | `tailwind.config.ts` (`darkMode: "class"`), `src/app/globals.css` | visual |
| A-4 | Prisma + SQLite locally, Postgres path documented | `prisma/schema.prisma` datasource, [deployment.md](deployment.md#switching-sqlite--postgres) | `BUILD` |
| A-5 | zod validation on every mutating API input | `readBody()` in `src/server/api.ts` returns 422 `validation_failed` with issue paths | UT: `api.test.ts` |
| A-6 | Money stored in integer cents (never floats) | monetary `Int` columns in `prisma/schema.prisma` (Order, PaymentEvent, RevenueRecord, Invoice, Product) | UT: `monetization.test.ts` |
| A-7 | Durable background processes | `npm run worker`, `npm run scheduler` (`scripts/worker.ts`, `scripts/scheduler.ts`) | `SMK` |

## 2. Data model

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| D-1 | ~50-model schema covering planning → distribution → monetization → CRM → analytics | 56 models in `prisma/schema.prisma`; 4 migrations in `prisma/migrations/` | `BUILD`, `CI` |
| D-2 | SQLite-safe modeling (string status columns validated by zod, `@@index` on hot paths) | status fields are `String`; zod enums in API schemas | `BUILD` |
| D-3 | Idempotent multi-workspace seed | `prisma/seed.ts` (workspace + creator + demo data: `creator@example.com` login) | `SMK`, `CI` |
| D-4 | Idempotency primitives for scheduled work | `IdempotencyKey`, `Report @@unique([workspaceId, kind, forDate, timezone])` | UT: `brief.test.ts` |

## 3. Auth, tenancy & security

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| S-1 | Credentials auth with hashed passwords, JWT sessions (next-auth v4) | `src/lib/auth.ts` + `bcryptjs` salts | `SMK` (login via cookie flow) |
| S-2 | Every API route session-checked server-side | `withAuth()` → `requireSession()` (`src/lib/authz.ts`) returns 401/403 | UT: `api.test.ts` |
| S-3 | Workspace membership scoping on all data access | every route resolves `ctx.workspaceId`; media re-checks membership at serve time | UT: `publish-fail-closed.test.ts` (route-level) |
| S-4 | Private media, no public CDN | `src/server/storage.ts` writes under `.storage/`; served only via `/api/media/[id]/raw` | SMK, [security.md#storage-media-privacy](security.md#storage-media-privacy) |
| S-5 | Rate limiting on API routes | `rateLimit()` in `src/server/api.ts` (429 `rate_limited`) | UT: `api.test.ts` |
| S-6 | Audit trail with truncated metadata, no secrets | `audit()` in `src/server/api.ts` (meta capped 4000 chars) | UT: `api.test.ts` |
| S-7 | Secrets never committed | `.env` gitignored; `src/lib/env.ts` treats `change-me*` values as unconfigured | repo inspection |
| S-8 | Password reset flow with expiring tokens | `PasswordResetToken` model + `/api/auth/forgot`, `/api/auth/reset`, (auth) pages | `BUILD` |
| S-9 | Stripe events only via HMAC-verified webhooks | `/api/webhooks/stripe` verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET` | UT: `monetization.test.ts` |

## 4. Studio Director, agents & task lifecycle

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| G-1 | Director classifies natural-language intent into task types | `classifyIntent()` in `src/server/agents/director.ts` → `createTask()` | `SMK` (chat intake) |
| G-2 | 18 task types across research → publish → analytics → sales | `TASK_TYPES` in `src/server/agents/types.ts` (research.brief … brief.morning) | `BUILD` |
| G-3 | Handlers dispatch agents; outputs verified before completion | `src/server/agents/handlers.ts` + `verifyOutputRefs()` checks artifact refs for dangling pointers | UT: `agent-pipeline.test.ts` |
| G-4 | Task lifecycle: `queued → running → succeeded / failed / waiting_for_approval / cancelled` | `finalizeTask()` widened to include `waiting_for_approval` | UT: `agent-pipeline.test.ts` |
| G-5 | Inline drain for dev + durable worker for prod | `drainQueueInline()` (20s budget) in `dispatch.ts`; `runTaskByIdBlocked()` in `src/server/queue/runner.ts` | UT: `agent-pipeline.test.ts`, `SMK` |
| G-6 | Workflow orchestration (content → publish pipeline) | `advanceWorkflow()` on director; `WorkflowDefinition`/`WorkflowExecution` models; `/api/workflows`; studio pages | `SMK` (execution started) |
| G-7 | Morning brief agent produced from live workspace data | `src/server/agents/brief.ts` → `generateMorningBrief()`; idempotent per workspace+date | UT: `brief.test.ts`, `SMK` |
| G-8 | Agent roster + task execution UI | `/(app)/studio/{agents,director,tasks,tasks/[id],executions}` pages | `BUILD`, `SMK` |

## 5. Approvals & publish gates (fail-closed)

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| V-1 | Human approval gate actually blocks publishing | `attemptPublish` refuses without `approved` → 409 `approval_required`; approval rows only created via `createApprovalRequest()` in `src/server/approvals.ts` | UT: `publish-fail-closed.test.ts`, `approvals.test.ts` |
| V-2 | Approval decisions carry side effects per type | `decideApproval()` in `src/server/approvals.ts` (script version promote etc.) | UT: `approvals.test.ts`, `SMK` (script approve → promote) |
| V-3 | Approved script versions are archived, never deleted | `DELETE /api/scripts/[id]` → 409 `delete_by_version` | documented behavior verified in route |
| V-4 | Distribution fails closed on missing platform connection | `POST /api/distribution` → recorded failure `platform_not_connected`; failed `PublishedPost` row (not a fake success) | UT: `publish-fail-closed.test.ts`, `SMK` |

## 6. Content production pipeline

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| P-1 | Topic ideation + content calendar | Workspace topics/calendar models; `/api/topics(+[id])`, `/api/calendar(+[id])`; `/(app)/workspace/{topics,content-calendar}` | `BUILD` |
| P-2 | Script workspace w/ generate + AI docs | `/api/scripts`, `/api/scripts/[id]`, `/api/scripts/[id]/generate`; scripts pages | UT: `approvals.test.ts` |
| P-3 | Voice lab: voice profiles, TTS jobs, transcription | `VoiceProfile`, `ProductionProject`; `/api/voice-jobs`, `/api/voice-notes`; voice-lab page | UT: `providers.test.ts` |
| P-4 | Multi-language localization with variants + review | `LocalizationProject/Variant`, `TranslationGlossary`; `/api/localization(+[projectId])`; localization page; `src/server/variant-review.ts` | `BUILD` |
| P-5 | Video jobs (assemble). No fabricated renders | `/api/video-jobs`; mock video adapter **throws** on synthetic render; fixture adapter never writes an MP4 | UT: `providers.test.ts`, `integrations.test.ts` |
| P-6 | Thumbnails + A/B experiments | `/api/thumbnails`, `/api/thumbnails/experiments` (fixture SVG, labeled) | UT: `providers.test.ts` |
| P-7 | Repurposing engine → clips | `/api/repurpose`; `RepurposeJob`, `GeneratedClip`; repurpose page | `BUILD` |
| P-8 | Media library with folders + private upload | `/api/media`, `/api/media/[id]/raw`; media-library page | SMK |

## 7. Distribution

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| B-1 | Platform account registry (connect states) | `SocialAccount`; `/api/social/accounts`; distribution/accounts page | `BUILD` |
| B-2 | Campaign → scheduled post → published post lifecycle | `DistributionCampaign`, `ScheduledPost`, `PublishedPost`, `PostMetric`; `/api/distribution(+[id])` | UT: `publish-fail-closed.test.ts` |
| B-3 | Publish only on approved assets & connected platforms | gate order: approval → connection check → record outcome | UT: `publish-fail-closed.test.ts` |
| B-4 | Queue & posts dashboards | `/(app)/distribution/{queue,posts}` | `BUILD` |

## 8. Maya — AI sales agent

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| M-1 | Maya answers leads as an assistant that *identifies as AI* | `/api/maya` system prompt: *"You MUST state clearly that you are an AI assistant"*; fixture reply text opens `Hi! I'm AI Maya…`; conversations page shows AI badge; answers beyond catalog escalate to a human | SMK, code review of `src/app/api/maya/route.ts` |
| M-2 | Conversations + messages with manual takeover | `Conversation`, `ConversationMessage`; `/api/maya(+[id])`; ai-maya pages | `BUILD` |
| M-3 | Attach lead, escalate to human, close | `/api/maya/[id]/{escalate,close,attach_lead}` | `BUILD` |
| M-4 | CRM pipeline for leads & contacts | `Contact`, `Lead`, `CrmActivity`; `/api/crm/leads(+[id])`; crm/leads pages | `BUILD` |
| M-5 | Appointments / bookings (Cal API ready, manual fallback) | `Appointment` model; `/api/appointments`; `cal` integration status | `BUILD`, [integrations.md](integrations.md#communications) |

## 9. Monetization

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| C-1 | Products, orders, recurring subscriptions, invoices | `Product`, `Order`, `Subscription`, `Invoice`; `/api/monetization`; monetization pages | `BUILD` |
| C-2 | Payments verified **only** via provider webhook events | `PaymentEvent` from `/api/webhooks/stripe` after HMAC check | UT: `monetization.test.ts` |
| C-3 | Manual sales recorded but never conflated with provider truth | manual entry → `owner.manual_verified` event, `signatureVerified=false`; revenue line labeled `(manual verification)` | UT: `monetization.test.ts` |
| C-4 | Revenue roll-up ledger | `RevenueRecord` aggregates verified + labeled-manual entries | UT: `monetization.test.ts` |
| C-5 | Brand deal pipeline | `monetization/brand-deals` page; brand categories | `BUILD` |

## 10. Analytics & reporting

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| N-1 | Revenue + conversion dashboards | `/(app)/analytics/{revenue,conversions}`, `AnalyticsSnapshot`; `/api/analytics` | `BUILD` |
| N-2 | Data-quality honesty labels | brief metrics labeled `REAL / PARTIAL / NO-DATA` (never invented numbers) | UT: `brief.test.ts`, `SMK` (`isMock:true`) |
| N-3 | Morning brief delivered 2 ways | `npm run scheduler` (DST-safe `src/lib/time.ts`) or external cron → `POST /api/cron/morning-brief` with `x-cron-secret` | UT: `time.test.ts`, `brief.test.ts` |
| N-4 | Scheduled report lifecycle | `ScheduledReport` (`lastRunForDate`) | UT: `time.test.ts` |

## 11. Workspace, notifications, search, integrations registry

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| W-1 | Workspace asset hub (7 pages) | brand-profile, knowledge, media-library, style-guides, topics, content-calendar, voice-notes | `BUILD` |
| W-2 | Global search | `/(app)/search` server component queries six entities within the workspace (scripts, topics, tasks, knowledge, leads, media) | `BUILD` |
| W-3 | In-app notifications (+ optional Slack/email) | `Notification` model; `/api/notifications`; `slack`/`email` integrations | `BUILD` |
| W-4 | Honest integration status registry | `src/server/integrations.ts` derives `operational/configured/awaiting_credentials/awaiting_authorization/manual/mock/unsupported` | UT: `integrations.test.ts` |
| W-5 | Activity timeline | `/(app)/dashboard/activity`, `AuditLog` | `BUILD` |

## 12. Mobile (Android)

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| MO-1 | Android app via Capacitor shell to the web app | `capacitor.config.ts` (`com.creatorstudio.app`), `scripts/mobile/configure-capacitor.mjs` | [android-build.md](android-build.md) |
| MO-2 | Emulator works with zero config | default server `http://10.0.2.2:3000` (cleartext loopback) | configure script |
| MO-3 | APK produced in CI | `.github/workflows/android.yml` → artifact `creator-studio-debug-apk` | `CI` |

## 13. Testing & CI

| ID | Requirement | Implementation | Evidence |
|----|-------------|----------------|----------|
| T-1 | Unit suite for time, providers, pipeline, gates, money, brief, integrations, API | 9 files / 31 tests in `tests/unit/`, isolated throwaway DB (`tests/global-setup.ts`) | all green |
| T-2 | CI builds + tests on push/PR | `.github/workflows/ci.yml` (no third-party auth needed to run) | `CI` |

## 14. Non-negotiable rules compliance

| Rule | How it is enforced |
|------|--------------------|
| No fabricated outputs | Mock providers return deterministic fixtures with `isMock` flags; the video fixture throws instead of inventing an MP4; failed publishes are recorded as failures |
| Never present dev fixtures as real | Every list surface renders a **DEV** badge from `isMock`; brief metrics carry REAL/PARTIAL/NO-DATA labels |
| AI agents identify as AI | Maya's reply contract requires self-identification before sales assistance |
| Approval gates block publishing | Server-side check, not UI sugar (409 `approval_required`) |
| No fake publishes / fake payments | Publish rows only after gate passes; `PaymentEvent` rows carry provider signature truth (`signatureVerified`); manual labels can never masquerade as verified |

## 15. Known gaps & deviations

1. **External providers run in fixture mode** until real API keys are configured — integration statuses show `awaiting_credentials` and dev fixtures are clearly labeled. No live provider has been claimed as live.
2. **Manual-workflow integrations** (Substack, Spotify RSS, Descript, Canva, Premiere, Krisp, Google Docs, Metricool) are documented human hand-offs in [integrations.md](integrations.md) — not silent stubs.
3. **Rate limiting is in-process** — document scaling guidance in [deployment.md](deployment.md#scale-notes).
4. **Search** is a scoped Postgres-ready scanner (replaceable with an index in future work).
5. Localization machine translation runs on the fixture LLM until a translation provider is configured; the review workflow is fully wired.
