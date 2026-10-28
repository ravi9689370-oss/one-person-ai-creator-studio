# Integrations Guide

The integration registry lives in `src/server/integrations.ts`. Its core promise: **status is derived from real configuration + verification, never from hope.** Nothing is labeled operational until it is checked; nothing with missing credentials is labeled live.

## Status semantics

| Status | Meaning |
|--------|---------|
| `operational` | Configured **and** verified usable (adapter ran a real success check) |
| `configured` | Credentials present, not yet verified |
| `awaiting_credentials` | No credentials configured |
| `awaiting_authorization` | Credentials present, user grant pending (e.g. missing voice ID) |
| `manual` | No suitable public API in scope; documented human workflow |
| `mock` | Development fixture adapter exists (marked `isMock` → **DEV** badge in UI) |
| `unsupported` | Capability not feasible |

Capabilities per provider are stored (`capabilities` JSON + `capabilityNotes`) with values `yes / no / unverified / manual`. `lastSuccessAt` / `lastErrorAt` record adapter runs. Statuses refresh whenever `GET /api/integrations` is hit — the **/integrations** page does this, so simply opening the page re-derives current state (it upserts derived state).

## Provider reference

### AI & voice (fixture-mode by default)

| Provider | Unconfigured status | Capabilities | Live setup |
|----------|--------------------:|--------------|------------|
| Anthropic (LLM) | `awaiting_credentials` | script generation | `ANTHROPIC_API_KEY` |
| OpenAI (LLM / Whisper / images) | `awaiting_credentials` | llm, transcription, image gen | `OPENAI_API_KEY`, optional `OPENAI_IMAGE_API_KEY` |
| ElevenLabs (TTS/dubbing) | `awaiting_credentials` → `awaiting_authorization` if voice ID missing | speech, multilingual dubbing | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` |
| `llm_mock`, `tts_mock`, `image_mock` | always `mock` | deterministic fixtures, `isMock: true` | nothing to configure |
| `video_mock` | always `mock` | **assemble-only packaging**; synthetic render `no` — the adapter *throws* rather than emit a fake MP4 | deliberately refuses to fabricate |

Whisper transcription follows `OPENAI_API_KEY`; force selection with `TRANSCRIPTION_PROVIDER`, `IMAGE_PROVIDER`, `VIDEO_PROVIDER`.

### Storage

`local_storage` is the default and is **`operational`** (self-checked on refresh): upload media, serve through the membership-checked endpoint `/api/media/[id]/raw`. Cloud adapters are documented in [architecture.md#storage--media](architecture.md#storage--media).

### Social publishing

| Platform | Status without creds | Live setup |
|----------|---------------------:|------------|
| YouTube | `awaiting_credentials` | `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` |
| TikTok | `awaiting_credentials` | `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET` |
| Instagram / Facebook | `awaiting_credentials` | `META_APP_ID` + `META_APP_SECRET` |
| LinkedIn | `awaiting_credentials` | `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` |
| Substack | **`manual`** | [Manual workflows](#manual-workflows) |
| Spotify (podcast) | **`manual`** | RSS hand-off |

Until OAuth apps are connected, any publish to these platforms **fails closed** (`platform_not_connected`) and records the failure — no fake success rows.

### Payments — Stripe

- Status: `configured` when `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` present (else `awaiting_authorization` / `awaiting_credentials`).
- Webhook endpoint: **`POST /api/webhooks/stripe`** — requires valid HMAC signature; unverified events are rejected.
- Manual sales are recorded but must never be conflated with provider truth: they become `PaymentEvent(kind="owner.manual_verified", signatureVerified=false)` and revenue lines are labeled `(manual verification)`. See [operations.md#recording-a-manual-sale](operations.md#recording-a-manual-sale).

### Communications

| Provider | Status | Live setup |
|----------|--------|------------|
| Slack | `awaiting_credentials` | `SLACK_WEBHOOK_URL` |
| Email (SMTP) | `awaiting_credentials` | `SMTP_HOST` (+ `SMTP_PORT`, `NOTIFY_EMAIL_TO`) |
| Cal (bookings) | `awaiting_credentials` | `CAL_API_KEY` |

## Manual workflows

Intentional `manual` status — these tools do not offer a publish API in scope, so the studio records the work item and shows a checkable hand-off instead of pretending automation:

| Tool | Workflow |
|------|----------|
| **Substack** | Generate the script/post in the studio → copy the approved text into the Substack editor → schedule there → mark the scheduled post done in **/distribution/posts** |
| **Spotify (podcast)** | RSS hand-off: host the MP3 + RSS feed on your existing host; propose the episode URL in Spotify for Podcasters → track the distribution row manually |
| **Descript** | Import the studio script → edit → export → upload the artifact under the project (media library) |
| **Canva** | Export brief/spec → design in Canva → upload as media; thumbnails experiments track the variants |
| **Premiere** | Assemble plan (timecodes + captions) exported from the video job → edit → upload the rendered asset |
| **Krisp** | Clean audio outside the studio → attach to the voice job |
| **Google Docs** | Sync script text out/in; the script room remains the source of truth |
| **Metricool** | Analytics fetched manually; enter verified numbers only — the brief will label them `REAL` (quality rules in [operations.md](operations.md#data-quality-labels)) |

## Verifying a connection went live

1. Add the env var(s), restart the app (or platform).
2. Open **/integrations** → the provider must move to `configured` with `unverified` capabilities.
3. Exercise it once (e.g. generate a script, send a test webhook) → `lastSuccessAt` timestamps the verified success.
4. For OAuth platforms, register callbacks and connect the account in **/distribution/accounts**; then a real publish run turns the platform `operational`.

## Full environment variable reference

All in `src/lib/env.ts` (optional unless marked required-first-run):

```
# Required (first run)
DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET

# Seed (dev convenience)
SEED_CREATOR_EMAIL, SEED_CREATOR_PASSWORD, SEED_WORKSPACE_NAME

# AI / media providers
ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENAI_IMAGE_API_KEY,
ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID,
TRANSCRIPTION_PROVIDER, IMAGE_PROVIDER, VIDEO_PROVIDER, HIGGSFIELD_API_KEY

# Social OAuth
YOUTUBE_CLIENT_ID / SECRET, TIKTOK_CLIENT_KEY / SECRET,
META_APP_ID / SECRET, LINKEDIN_CLIENT_ID / SECRET

# Payments / communications
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SLACK_WEBHOOK_URL,
SMTP_HOST, SMTP_PORT, NOTIFY_EMAIL_TO, CAL_API_KEY

# Mobile shell
CREATOR_STUDIO_SERVER_URL
```

Values equal to `change-me…` are treated as unconfigured by `src/lib/env.ts`, so placeholder secrets cannot flip statuses.
