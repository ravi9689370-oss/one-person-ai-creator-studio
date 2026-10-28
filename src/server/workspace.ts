/**
 * Creates a workspace with its default scaffolding:
 * default agent registry, integrations rows, morning brief
 * schedule, and the PRD's example product catalog (configurable placeholders).
 */
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

export const DEFAULT_AGENT_DEFS = [
  { key: "director", name: "Studio Director", description: "Classifies tasks, plans workflows, selects agents, tracks execution.", capabilities: ["route", "plan", "verify"] },
  { key: "research", name: "Research Agent", description: "Gathers source material and prepares research briefs with references.", capabilities: ["research.brief"] },
  { key: "strategy", name: "Strategy Agent", description: "Content ideas, formats, and experiments from historical data.", capabilities: ["ideate", "plan"] },
  { key: "script", name: "Script Agent", description: "Hooks, drafts, variations, platform-specific copy in brand voice.", capabilities: ["script.generate", "script.revise"] },
  { key: "voice", name: "Voice Agent", description: "Prepares speech requests and verifies delivered audio assets.", capabilities: ["voice.generate"] },
  { key: "localization", name: "Localization Agent", description: "Translation with glossaries, subtitles, dubbed-track orchestration.", capabilities: ["translate", "subtitle"] },
  { key: "video", name: "Video Production Agent", description: "Assembles shots, captions, and render orchestration.", capabilities: ["video.assemble"] },
  { key: "thumbnail", name: "Thumbnail Agent", description: "Concepts, variants, and A/B experiment tracking.", capabilities: ["thumbnail.concept"] },
  { key: "repurpose", name: "Repurposing Agent", description: "Clip candidates, captions, descriptions from long-form.", capabilities: ["clip.generate"] },
  { key: "distribution", name: "Distribution Agent", description: "Publishing packages, platform validation, scheduling.", capabilities: ["publish.prepare"] },
  { key: "sales", name: "Audience & Sales Agent", description: "AI Maya's engine: intent, FAQ, qualification, recommendations.", capabilities: ["maya.reply", "lead.qualify"] },
  { key: "analytics", name: "Analytics Agent", description: "Ingests verified data, computes metrics, explains limitations.", capabilities: ["report.generate"] },
  { key: "quality", name: "Quality & Compliance Agent", description: "Field checks, brand rules, misleading-claim detection.", capabilities: ["review.content"] },
] as const;

// PRD example offerings - configurable values seeded once, editable in-app.
// Prices are the PRD's example values, not verified market prices.
export const DEFAULT_PRODUCTS = [
  { key: "short_form_course", name: "Short-Form Content System Course", kind: "course", priceCents: 49700, description: "Self-paced course (PRD example offering)." },
  { key: "one_on_one_coaching", name: "1:1 Coaching", kind: "coaching", priceCents: 200000, description: "Monthly coaching engagement (PRD example offering)." },
  { key: "brand_deals", name: "Brand Deals", kind: "brand_deal", priceCents: 2500000, description: "Brand integration package (PRD example offering)." },
] as const;

export async function createWorkspace(input: {
  name: string;
  timezone?: string;
  userId: string;
}): Promise<{ workspaceId: string }> {
  const workspace = await prisma.workspace.create({
    data: { name: input.name, slug: slugify(input.name), timezone: input.timezone ?? "UTC" },
  });
  const member = await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: input.userId, role: "owner" },
  });

  await prisma.brandProfile.create({
    data: {
      workspaceId: workspace.id,
      displayName: input.name,
      tone: "confident, friendly",
      voice: "",
      personas: { create: [] },
    },
  });

  await prisma.agent.createMany({
    data: DEFAULT_AGENT_DEFS.map((a) => ({
      workspaceId: workspace.id,
      key: a.key,
      name: a.name,
      description: a.description,
      capabilities: JSON.stringify([...a.capabilities]),
    })),
  });

  await prisma.product.createMany({
    data: DEFAULT_PRODUCTS.map((p) => ({
      workspaceId: workspace.id,
      key: p.key.replace(/[^a-z_]/g, ""),
      name: p.name,
      kind: p.kind,
      priceCents: p.priceCents,
      description: p.description,
    })),
  });

  // Integration registry: statuses derive from actual configuration detection.
  const integrationSeed = [
    { providerKey: "anthropic", category: "ai", capabilityNotes: "LLM (claude) for scripts, planning, Maya replies." },
    { providerKey: "openai", category: "ai", capabilityNotes: "LLM + Whisper transcription + image APIs." },
    { providerKey: "elevenlabs", category: "ai", capabilityNotes: "Speech generation (authorized voices only) + speech-to-speech." },
    { providerKey: "stripe", category: "payments", capabilityNotes: "Payments + webhooks; sandbox for development." },
    { providerKey: "youtube", category: "social", capabilityNotes: "Publish + metrics via official Data API (OAuth, scheduled quotas)." },
    { providerKey: "tiktok", category: "social", capabilityNotes: "Content Posting API (app review required by platform)." },
    { providerKey: "instagram", category: "social", capabilityNotes: "Publishing via Meta Graph API (professional account)." },
    { providerKey: "facebook", category: "social", capabilityNotes: "Page publishing via Meta Graph API." },
    { providerKey: "linkedin", category: "social", capabilityNotes: "Post publishing via LinkedIn API (member authorization)." },
    { providerKey: "substack", category: "social", capabilityNotes: "No official public API documented in PRD scope: manual workflow." },
    { providerKey: "spotify", category: "social", capabilityNotes: "Podcast hosting via RSS ingestion: manual/external workflow." },
    { providerKey: "slack", category: "communications", capabilityNotes: "Incoming webhook notifications." },
    { providerKey: "cal", category: "communications", capabilityNotes: "Booking links for AI Maya appointments." },
    { providerKey: "descript", category: "media", capabilityNotes: "Manual handoff for advanced audio editing." },
    { providerKey: "higgsfield", category: "media", capabilityNotes: "Video generation adapter (API credentials pending)." },
    { providerKey: "canva", category: "media", capabilityNotes: "Manual design export/import workflow." },
    { providerKey: "premiere", category: "media", capabilityNotes: "Manual video edit handoff; job-based workflow." },
    { providerKey: "krisp", category: "media", capabilityNotes: "Noise reduction integration boundary (desktop tool)." },
    { providerKey: "gdocs", category: "media", capabilityNotes: "Manual export of scripts to Google Docs." },
    { providerKey: "metricool", category: "analytics", capabilityNotes: "Cross-platform metrics aggregation boundary." },
    { providerKey: "local_storage", category: "storage", capabilityNotes: "Filesystem storage adapter (uploads dir keys)." },
  ].map((i) => ({
    workspaceId: workspace.id,
    providerKey: i.providerKey,
    category: i.category,
    status: i.providerKey === "local_storage" ? "operational" : "awaiting_credentials",
    capabilityNotes: i.capabilityNotes,
    capabilities: "[]",
  }));
  await prisma.integration.createMany({ data: integrationSeed });

  await prisma.scheduledReport.create({
    data: {
      workspaceId: workspace.id,
      kind: "morning_brief",
      hourLocal: 7,
      minuteLocal: 0,
      timezone: workspace.timezone,
      channels: '["in_app"]',
      enabled: true,
    },
  });

  await prisma.workflowDefinition.createMany({
    data: WORKFLOW_DEFAULTS.map((w) => ({
      workspaceId: workspace.id,
      key: w.key,
      name: w.name,
      description: w.description,
      definition: JSON.stringify(w.definition),
    })),
  });

  return { workspaceId: workspace.id };
}

type Step = { key: string; agentKey: string; approval?: boolean; needs?: string[] };

export const WORKFLOW_DEFAULTS: {
  key: string;
  name: string;
  description: string;
  definition: { steps: Step[] };
}[] = [
  {
    key: "content_to_publish",
    name: "Content production → publication",
    description: "Topic → script → voice → video → approval gates → publishing package.",
    definition: {
      steps: [
        { key: "research", agentKey: "research", needs: ["topic"] },
        { key: "script", agentKey: "script", approval: true, needs: ["research"] },
        { key: "voice", agentKey: "voice", approval: true, needs: ["script"] },
        { key: "video", agentKey: "video", approval: true, needs: ["voice"] },
        { key: "publish_prepare", agentKey: "distribution", approval: true, needs: ["video"] },
      ],
    },
  },
  {
    key: "dubb_multilang",
    name: "Multilingual dubbing",
    description: "Transcribe → translate (glossary) → review → dub → subtitles.",
    definition: {
      steps: [
        { key: "transcribe", agentKey: "localization" },
        { key: "translate", agentKey: "localization", approval: true },
        { key: "dub", agentKey: "localization" },
      ],
    },
  },
  {
    key: "repurpose_shorts",
    name: "Shorts repurposing",
    description: "Long-form → clips → captions → review → export.",
    definition: {
      steps: [
        { key: "clip_candidates", agentKey: "repurpose", approval: true },
        { key: "render", agentKey: "video" },
      ],
    },
  },
];
