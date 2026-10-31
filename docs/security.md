# Security & Privacy

## Authentication & authorization

- **AuthN:** next-auth v4 credentials provider; passwords hashed with `bcryptjs`; JWT session strategy. `src/lib/auth.ts`. Flows: register, login, forgot/reset (expiring, single-use `PasswordResetToken`).
- **AuthZ:** every API route calls `withAuth()` (`src/server/api.ts`) → `requireSession()` resolves the caller's workspace membership (`src/lib/authz.ts`). Requests without a session get `401 unauthenticated`; accounts with no workspace get `403 no_workspace`.
- **Tenancy:** every Prisma query in route/page code is scoped by `workspaceId`. There is no cross-workspace read path through the product APIs.
- **CSRF:** tested cookie + session flows through next-auth's CSRF token handling (verification on POST via CSRF token in the test suite).

## Input validation & abuse limits

- All JSON bodies are parsed by **zod** (`readBody`): malformed → `400 invalid_json`, schema violation → `422 validation_failed` with field-level issues.
- Request-size guard: bodies > 10 MB are rejected (`413 payload_too_large`).
- In-memory **rate limiter** (`rateLimit()`) returns `429 rate_limited` per user+route. Note: it is per-process — see [deployment.md#scale-notes](deployment.md#scale-notes) for multi-instance deployments.
- `AuditLog` via `audit()` records actor, workspace, action, object, IP and metadata truncated to 4000 chars — secrets and full customer payloads are deliberately excluded.

## Storage (media privacy)

- Uploads never land in `public/`. They are written by `src/server/storage.ts` under `.storage/` (workspace-scoped keys), which the `.gitignore` excludes.
- Serving is only through `GET /api/media/[id]/raw`, which re-checks workspace membership **on every request**. Media is otherwise private-by-default; no public CDN is used.
- Internal SQLite files (`prisma/*.db`) and DB directories are gitignored; uploads directory `.storage/` is gitignored.

## Secrets handling

- `.env` is gitignored and local-only; never committed. The deployment target keeps secrets in its secret store.
- `src/lib/env.ts` treats values beginning with `change-me` as **unconfigured** — placeholder secrets cannot flip integration statuses or unlock providers.
- `CRON_SECRET` gates the morning-brief cron endpoint: `POST /api/cron/morning-brief` requires the `x-cron-secret` header; unconfigured/placeholder secrets mean the endpoint refuses (fail-closed).
- Frontend code never imports server env (`serverEnv`, `providerEnv()` are server modules; ESLint/code review enforces the boundary).

## Payments integrity

- Stripe logic trusts **only** webhook events with a valid `stripe-signature` HMAC against `STRIPE_WEBHOOK_SECRET`.
- Manual owner-entered sales are stored distinctly: `PaymentEvent(kind="owner.manual_verified", signatureVerified=false)` and labeled `(manual verification)` in revenue — they can never be presented as provider-verified truth.

## Publishing & approval integrity (anti-fabrication)

- Publishing requires an approved asset: `attemptPublish` returns `409 approval_required` otherwise, **server-side**.
- Publishing to an unconnected platform records a failed outcome (`platform_not_connected`) and a failed `PublishedPost` row — the system never invents successful posts.
- The mock video adapter throws when asked to fabricate an MP4; the only buildable fixture mode is "assemble-only packaging".
- Agent task outputs pass `verifyOutputRefs()` before `finalizeTask()` allows `succeeded` — invalid artifact references fail the task instead of shipping broken state.
- All dev-fixture outputs are marked `isMock` and show a **DEV** badge in every list UI; the morning brief labels each section `REAL / PARTIAL / NO-DATA` rather than inventing numbers.

## AI disclosure

- AI Maya's system prompt requires it to **state clearly that it is an AI assistant** in every reply, and replies beyond the catalog escalate to a human.
- AI-produced content is a fixture (`isMock`) until real providers are configured, so nothing pretends to be human-produced output.

## Network & transport

- Sessions rely on secure cookies; deploy behind HTTPS (NextAuth sets secure-cookie behavior appropriate to the environment).
- The Android shell is a remote-URL app: keep the production server on HTTPS; cleartext is accepted only for the emulator's loopback (`http://10.0.2.2:3000`) — see [android-build.md](android-build.md).

## Operational checklist before going live

1. Set `DATABASE_URL`, `NEXTAUTH_SECRET` (strong), `NEXTAUTH_URL` (HTTPS origin) on the host.
2. Change the seeded creator password or disable the seed on shared deployments.
3. Configure `CRON_SECRET` for external cron, or rely on the in-process scheduler.
4. Point Stripe webhooks at `/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET`.
5. Review `/integrations` — treat anything `awaiting_*` or `mock` as not-live.
6. Read `/reports/morning-brief` labels before quoting any metric.
