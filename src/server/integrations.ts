/**
 * Integration registry: derives each provider's REAL status from configuration
 * detection + recorded verification timestamps. Status meaning:
 *   operational                 - configured and verified usable
 *   configured                  - credentials present, not yet verified
 *   awaiting_credentials        - no credentials configured
 *   awaiting_authorization      - credentials present, user grant pending
 *   manual                      - no suitable API; documented manual workflow
 *   mock                        - development fixture adapter exists
 *   unsupported                 - capability not feasible
 */
import { prisma } from "@/lib/db";
import { providerEnv } from "@/lib/env";
import { llmConfigured, type ProviderMode } from "@/server/providers/llm";
import { ttsConfigured } from "@/server/providers/tts";
import { transcriptionConfigured } from "@/server/providers/transcription";
import { imageConfigured } from "@/server/providers/image";
import { videoConfigured } from "@/server/providers/video";
import { storageOperational } from "@/server/storage";

export type Capability = {
  name: string;
  supported: "yes" | "no" | "unverified" | "manual";
};

export type IntegrationStatus =
  | "operational"
  | "configured"
  | "awaiting_credentials"
  | "awaiting_authorization"
  | "manual"
  | "mock"
  | "unsupported";

const CATEGORY_PROVIDERS: Record<string, string[]> = {
  ai: ["anthropic", "openai", "elevenlabs", "whisper"],
  storage: ["local_storage"],
  social: ["youtube", "tiktok", "instagram", "facebook", "linkedin", "substack", "spotify"],
  payments: ["stripe"],
  communications: ["slack", "cal", "email"],
  media: ["descript", "higgsfield", "canva", "premiere", "krisp", "gdocs"],
  analytics: ["metricool"],
};

export async function refreshIntegrationStatuses(workspaceId: string): Promise<void> {
  const env = providerEnv();
  const llm = llmConfigured();
  const tts = ttsConfigured();
  const asr = transcriptionConfigured();
  const img = imageConfigured();
  const vid = videoConfigured();

  const set: Record<string, { status: IntegrationStatus; isMock?: boolean; capabilities?: Capability[]; capabilityNotes?: string }> = {};

  set.local_storage = {
    status: storageOperational() ? "operational" : "configured",
    capabilities: [
      { name: "upload media", supported: "yes" },
      { name: "serving via authed endpoint", supported: "yes" },
    ],
    capabilityNotes: "Local filesystem adapter; cloud storage adapter documented in docs/architecture.md.",
  };

  set.anthropic = {
    status: env.anthropicApiKey ? (llm.provider === "anthropic" ? "configured" : "awaiting_credentials") : "awaiting_credentials",
    capabilities: [{ name: "script generation", supported: env.anthropicApiKey ? "unverified" : "no" }],
  };
  set.openai = {
    status: env.openaiApiKey ? "configured" : "awaiting_credentials",
    capabilities: [
      { name: "llm", supported: env.openaiApiKey ? "unverified" : "no" },
      { name: "whisper transcription", supported: env.openaiApiKey ? "unverified" : "no" },
      { name: "image generation", supported: env.openaiImageApiKey ? "unverified" : "no" },
    ],
  };
  set.elevenlabs = {
    status: env.elevenlabsApiKey ? (process.env.ELEVENLABS_VOICE_ID ? "configured" : "awaiting_authorization") : "awaiting_credentials",
    capabilities: [
      { name: "speech generation", supported: env.elevenlabsApiKey ? "unverified" : "no" },
      { name: "multilingual dubbing audio", supported: env.elevenlabsApiKey ? "unverified" : "no" },
    ],
  };
  set.whisper = { status: env.openaiApiKey ? "configured" : "awaiting_credentials", capabilities: [{ name: "transcription", supported: env.openaiApiKey ? "unverified" : "no" }] };

  set.tts_mock = { status: "mock", isMock: true, capabilities: [{ name: "speech (fixture)", supported: "yes" }], capabilityNotes: "Labeled development fixture audio for local testing." };
  set.llm_mock = { status: "mock", isMock: true, capabilities: [{ name: "llm (fixture)", supported: "yes" }], capabilityNotes: "Labeled development fixture LLM for local testing." };

  set.stripe = {
    status: env.stripeSecretKey && env.stripeWebhookSecret ? "configured" : env.stripeSecretKey ? "awaiting_authorization" : "awaiting_credentials",
    capabilities: [
      { name: "checkout sessions", supported: env.stripeSecretKey ? "unverified" : "no" },
      { name: "webhook verification", supported: env.stripeWebhookSecret ? "unverified" : "no" },
    ],
    capabilityNotes: "Webhook endpoint: /api/webhooks/stripe (signature required).",
  };

  const socialMap: Record<string, { id: string | undefined; secretId?: string | undefined }> = {
    youtube: { id: env.youtubeClientId, secretId: env.youtubeClientSecret },
    tiktok: { id: env.tiktokClientKey, secretId: env.tiktokClientSecret },
    instagram: { id: env.metaAppId, secretId: env.metaAppSecret },
    facebook: { id: env.metaAppId, secretId: env.metaAppSecret },
    linkedin: { id: env.linkedinClientId, secretId: env.linkedinClientSecret },
  };
  for (const [key, cfg] of Object.entries(socialMap)) {
    set[key] = {
      status: cfg.id && cfg.secretId ? "configured" : cfg.id ? "awaiting_authorization" : "awaiting_credentials",
      capabilities: [{ name: "publish", supported: cfg.id && cfg.secretId ? "unverified" : "no" }],
    };
  }
  set.substack = {
    status: "manual",
    capabilities: [{ name: "publish", supported: "manual" }],
    capabilityNotes: "No official public publishing API in scope. Manual workflow documented in docs/integrations.md.",
  };
  set.spotify = {
    status: "manual",
    capabilities: [{ name: "podcast distribution", supported: "manual" }],
    capabilityNotes: "Distribution via podcast RSS hand-off: manual workflow.",
  };

  set.slack = {
    status: env.slackWebhookUrl ? "configured" : "awaiting_credentials",
    capabilities: [{ name: "notifications", supported: env.slackWebhookUrl ? "unverified" : "no" }],
  };
  set.email = {
    status: env.smtpHost ? "configured" : "awaiting_credentials",
    capabilities: [{ name: "notifications", supported: env.smtpHost ? "unverified" : "no" }],
  };
  set.cal = { status: env.calApiKey ? "configured" : "awaiting_credentials", capabilities: [{ name: "booking links", supported: env.calApiKey ? "unverified" : "no" }] };

  set.higgsfield = {
    status: env.higgsfieldApiKey ? "configured" : "awaiting_credentials",
    capabilities: [{ name: "video generation", supported: env.higgsfieldApiKey ? "unverified" : "no" }],
  };
  set.video_mock = {
    status: "mock",
    isMock: true,
    capabilities: [{ name: "assemble-only packaging", supported: "yes" }, { name: "synthetic render", supported: "no" }],
    capabilityNotes: "Fixture refuses to emit fake MP4 output; assemble-only mode verified in tests.",
  };
  for (const manual of ["descript", "canva", "premiere", "krisp", "gdocs", "metricool"]) {
    set[manual] = {
      status: "manual",
      capabilities: [{ name: manual === "premiere" ? "video edit handoff" : "export/import handoff", supported: "manual" }],
      capabilityNotes: "Documented manual workflow in docs/integrations.md.",
    };
  }
  set.image_mock = {
    status: "mock",
    isMock: true,
    capabilities: [{ name: "fixture thumbnails (labeled SVG)", supported: "yes" }],
  };

  // upsert with real derived state; keep lastSuccess/lastError untouched here
  const now = new Date();
  for (const [providerKey, v] of Object.entries(set)) {
    const category = Object.entries(CATEGORY_PROVIDERS).find(([, keys]) => keys.includes(providerKey))?.[0] ?? "media";
    const existing = await prisma.integration.findUnique({
      where: { workspaceId_providerKey: { workspaceId, providerKey } },
    });
    const data = {
      status: v.status,
      isMock: v.isMock ?? false,
      capabilities: v.capabilities ? JSON.stringify(v.capabilities) : existing?.capabilities ?? "[]",
      capabilityNotes: v.capabilityNotes ?? existing?.capabilityNotes ?? null,
    };
    if (existing) {
      await prisma.integration.update({ where: { id: existing.id }, data });
    } else {
      await prisma.integration.create({ data: { workspaceId, providerKey, category, ...data } });
    }
  }

  // storage adapter operational check timestamps a verified success
  if (set.local_storage.status === "operational") {
    await prisma.integration.update({
      where: { workspaceId_providerKey: { workspaceId, providerKey: "local_storage" } },
      data: { lastSuccessAt: now },
    }).catch(() => undefined);
  }
  void vid;
  void asr;
  void img;
  void llm;
  void tts;
}
