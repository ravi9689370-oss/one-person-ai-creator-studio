import { z } from "zod";

/**
 * Server-side environment access. Never import this from client components.
 * Missing optional keys resolve to "unconfigured" - the integration layer
 * reports these states instead of pretending a provider is live.
 */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 && !v.startsWith("change-me") ? v : undefined));

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export const serverEnv = {
  cronSecret: process.env.CRON_SECRET ?? "",
  seedCreatorEmail: process.env.SEED_CREATOR_EMAIL ?? "creator@example.com",
  seedCreatorPassword: process.env.SEED_CREATOR_PASSWORD ?? "",
  seedWorkspaceName: process.env.SEED_WORKSPACE_NAME ?? "My Creator Studio",
};

export function getCronSecret(): string | undefined {
  const s = process.env.CRON_SECRET;
  return s && !s.startsWith("change-me") ? s : undefined;
}

const schema = z.object({
  anthropicApiKey: optionalString,
  openaiApiKey: optionalString,
  elevenlabsApiKey: optionalString,
  transcriptionProvider: optionalString,
  imageProvider: optionalString,
  openaiImageApiKey: optionalString,
  videoProvider: optionalString,
  higgsfieldApiKey: optionalString,
  stripeSecretKey: optionalString,
  stripeWebhookSecret: optionalString,
  slackWebhookUrl: optionalString,
  smtpHost: optionalString,
  smtpPort: optionalString,
  notifyEmailTo: optionalString,
  calApiKey: optionalString,
  youtubeClientId: optionalString,
  youtubeClientSecret: optionalString,
  tiktokClientKey: optionalString,
  tiktokClientSecret: optionalString,
  metaAppId: optionalString,
  metaAppSecret: optionalString,
  linkedinClientId: optionalString,
  linkedinClientSecret: optionalString,
  creatorStudioServerUrl: optionalString,
});

const parsed = schema.safeParse({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
  transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER,
  imageProvider: process.env.IMAGE_PROVIDER,
  openaiImageApiKey: process.env.OPENAI_IMAGE_API_KEY ?? process.env.OPENAI_API_KEY,
  videoProvider: process.env.VIDEO_PROVIDER,
  higgsfieldApiKey: process.env.HIGGSFIELD_API_KEY,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT,
  notifyEmailTo: process.env.NOTIFY_EMAIL_TO,
  calApiKey: process.env.CAL_API_KEY,
  youtubeClientId: process.env.YOUTUBE_CLIENT_ID,
  youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET,
  tiktokClientKey: process.env.TIKTOK_CLIENT_KEY,
  tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET,
  metaAppId: process.env.META_APP_ID,
  metaAppSecret: process.env.META_APP_SECRET,
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID,
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  creatorStudioServerUrl: process.env.CREATOR_STUDIO_SERVER_URL,
});

export type ProviderEnv = z.infer<typeof schema>;

/** Throws only if the schema fails in an unexpected way (not just unconfigured). */
export function providerEnv(): ProviderEnv {
  return parsed.success ? parsed.data : {};
}
