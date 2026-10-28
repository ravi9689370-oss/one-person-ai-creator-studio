/**
 * Database seed. Creates the demo creator account + a clearly-labeled demo
 * workspace with fixture data. Everything created here carries demo/mock
 * labels where it represents simulated data. Idempotent: re-running skips work.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ZONE = process.env.TZ ?? "UTC";

async function main() {
  const email = (process.env.SEED_CREATOR_EMAIL ?? "creator@example.com").toLowerCase();
  const password = process.env.SEED_CREATOR_PASSWORD || "";
  const wsName = process.env.SEED_WORKSPACE_NAME ?? "Solo Creator HQ";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed: creator ${email} already exists - nothing to do.`);
    return;
  }
  if (!password) {
    console.log("Seed: SEED_CREATOR_PASSWORD not set - create your account via /register instead.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name: "Demo Creator", passwordHash, seeded: true },
  });

  const workspace = await prisma.workspace.create({
    data: { name: wsName, slug: "demo-workspace", timezone: ZONE },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });

  const brand = await prisma.brandProfile.create({
    data: {
      workspaceId: workspace.id,
      displayName: "Solo Creator HQ",
      tagline: "A one-person media company run with systems, not burnout.",
      tone: "confident, friendly",
      audience: "Creators and solo operators building content businesses.",
      guidelines: "No hype language. Always show the workflow behind the claim.",
      personas: {
        create: [
          { name: "Part-time Corner", description: "Creator with a day job, 5-10 hours per week for production.", painPoints: "Time, tool sprawl", goals: "Consistent publishing" },
          { name: "Full-time Builder", description: "Publishes daily across 4+ platforms.", painPoints: "Repurposing overhead, batch planning", goals: "Scale with one-person staffing" },
        ],
      },
    },
  });

  const gid = (n: number) => `g${n}`;
  void gid;
  let n = 0;
  const mk = () => `id${++n}`;

  // Products (example PRD offerings; editable in Monetization)
  const products: { key: string; name: string; kind: string; priceCents: number; description: string }[] = [
    { key: "short_form_course", name: "Short-Form Content System Course", kind: "course", priceCents: 49700, description: "Self-paced course (PRD example offering)." },
    { key: "one_on_one_coaching", name: "1:1 Coaching", kind: "coaching", priceCents: 200000, description: "Monthly coaching engagement (PRD example offering)." },
    { key: "brand_deals", name: "Brand Deals", kind: "brand_deal", priceCents: 2500000, description: "Brand integration package (PRD example offering)." },
  ];
  const createdProducts = await prisma.$transaction(
    products.map((p) =>
      prisma.product.create({
        data: { workspaceId: workspace.id, ...p },
      })
    )
  );
  void createdProducts;

  // Knowledge base fixture (labeled)
  await prisma.knowledgeDocument.create({
    data: {
      workspaceId: workspace.id,
      title: "Studio FAQ (demo fixture)",
      kind: "faq",
      content:
        "Q: How long does a batch day take? A: ~4 hours for 3 scripts with the approved pipeline.\n" +
        "Q: Which languages are supported for dubbing? A: The PRD target set: Spanish, Portuguese, Hindi, German, French, Japanese, Vietnamese, Arabic, Indonesian, Italian.\n" +
        "Q: Refund policy? A: Only what the business configuration authorizes - creators own this policy in Settings.",
    },
  });

  let topicIdea = "Repurposing long-form into 10 shorts";
  if (true) topicIdea = "Building a scalable one-person media system";
  await prisma.contentTopic.createMany({
    data: [topicIdea, "Batch-day behind-the-scenes", "Creator burnout systems", "Dubbing workflow walkthrough", "Thumbnail testing results"].map((t) => ({
      workspaceId: workspace.id,
      title: t,
      status: "idea",
    })),
  });

  const script = await prisma.script.create({
    data: {
      workspaceId: workspace.id,
      title: "The one-person media system (demo fixture)",
      format: "long_form",
      status: "draft",
      hook: "You do not need a team. You need a pipeline.",
      language: "en",
      createdById: user.id,
    },
  });
  await prisma.scriptVersion.create({
    data: {
      scriptId: script.id,
      version: 1,
      body:
        "[DEVELOPMENT FIXTURE SCRIPT BODY]\n\nHook: You do not need a team. You need a pipeline.\n\n" +
        "Cold open: the eight tabs of the old workflow, closing one by one.\n\n" +
        "Section 1 - Planning: one calendar, one knowledge base.\n" +
        "Section 2 - Production: script to voice to video with approvals.\n" +
        "Section 3 - Distribution: scheduled, not scattered.\n\n" +
        "CTA: If you run a one-person studio, this is your week-one build order.",
      tone: "confident, direct",
      targetMin: 8,
      createdById: user.id,
    },
  });

  // Credential-free integrations registry
  const integrationSeed = [
    { providerKey: "anthropic", category: "ai", capabilityNotes: "LLM (claude) for scripts, planning, Maya replies." },
    { providerKey: "openai", category: "ai", capabilityNotes: "LLM + Whisper transcription + image APIs." },
    { providerKey: "elevenlabs", category: "ai", capabilityNotes: "Speech generation (authorized voices only)." },
    { providerKey: "stripe", category: "payments", capabilityNotes: "Payments + webhooks; sandbox during development." },
    { providerKey: "youtube", category: "social", capabilityNotes: "Publish + metrics via official Data API (OAuth)." },
    { providerKey: "tiktok", category: "social", capabilityNotes: "Content Posting API (platform app review required)." },
    { providerKey: "instagram", category: "social", capabilityNotes: "Publishing via Meta Graph API (professional account)." },
    { providerKey: "facebook", category: "social", capabilityNotes: "Page publishing via Meta Graph API." },
    { providerKey: "linkedin", category: "social", capabilityNotes: "Posts via LinkedIn API (member authorization)." },
    { providerKey: "substack", category: "social", capabilityNotes: "No official publishing API in scope: manual workflow." },
    { providerKey: "spotify", category: "social", capabilityNotes: "Podcast hosting via RSS: manual external workflow." },
    { providerKey: "slack", category: "communications", capabilityNotes: "Incoming webhook notifications." },
    { providerKey: "cal", category: "communications", capabilityNotes: "Booking links for AI Maya appointments." },
    { providerKey: "descript", category: "media", capabilityNotes: "Manual handoff for advanced audio editing." },
    { providerKey: "higgsfield", category: "media", capabilityNotes: "Video generation adapter (credentials pending)." },
    { providerKey: "canva", category: "media", capabilityNotes: "Manual design export/import workflow." },
    { providerKey: "premiere", category: "media", capabilityNotes: "Manual video edit handoff." },
    { providerKey: "krisp", category: "media", capabilityNotes: "Noise reduction boundary (desktop tool)." },
    { providerKey: "gdocs", category: "media", capabilityNotes: "Manual script export." },
    { providerKey: "metricool", category: "analytics", capabilityNotes: "Cross-platform metrics aggregation boundary." },
    { providerKey: "local_storage", category: "storage", capabilityNotes: "Local filesystem storage adapter." },
  ].map((i, idx) => ({
    workspaceId: workspace.id,
    providerKey: i.providerKey,
    category: i.category,
    status: i.providerKey === "local_storage" ? "operational" : "awaiting_credentials",
    capabilityNotes: i.capabilityNotes,
    capabilities: JSON.stringify([mk(), idx === 0 ? "fixture-noted" : "noted"]),
  }));
  await prisma.integration.createMany({ data: integrationSeed });

  await prisma.agent.createMany({
    data: [
      { key: "director", name: "Studio Director", description: "Classifies, plans, routes, verifies.", capabilities: "[]" },
      { key: "research", name: "Research Agent", description: "Source briefs with references.", capabilities: "[]" },
      { key: "strategy", name: "Strategy Agent", description: "Ideas, formats, experiments.", capabilities: "[]" },
      { key: "script", name: "Script Agent", description: "Hooks, scripts, revisions in brand voice.", capabilities: "[]" },
      { key: "voice", name: "Voice Agent", description: "Speech generation and audio verification.", capabilities: "[]" },
      { key: "localization", name: "Localization Agent", description: "Translation, glossary, subtitles, dubbing tracks.", capabilities: "[]" },
      { key: "video", name: "Video Production Agent", description: "Assembly, captions, render orchestration.", capabilities: "[]" },
      { key: "thumbnail", name: "Thumbnail Agent", description: "Concepts, variants, experiment tracking.", capabilities: "[]" },
      { key: "repurpose", name: "Repurposing Agent", description: "Clip candidates and short-form variants.", capabilities: "[]" },
      { key: "distribution", name: "Distribution Agent", description: "Publishing packages and scheduling.", capabilities: "[]" },
      { key: "sales", name: "Audience & Sales Agent", description: "AI Maya engine: replies, FAQ, qualification.", capabilities: "[]" },
      { key: "analytics", name: "Analytics Agent", description: "Metrics, trends, daily brief.", capabilities: "[]" },
      { key: "quality", name: "Quality & Compliance Agent", description: "Checks, brand rules, claim review.", capabilities: "[]" },
    ].map((a) => ({ workspaceId: workspace.id, ...a, capabilities: "[]" })),
  });

  await prisma.workflowDefinition.createMany({
    data: [
      {
        key: "content_to_publish",
        name: "Content production → publication",
        description: "Topic → script → voice → video → approval gates → publishing package.",
        definition: JSON.stringify({
          steps: [
            { key: "research.brief", agentKey: "research", needs: [] },
            { key: "script.generate", agentKey: "script", needs: ["research.brief"], approval: true },
            { key: "voice.generate", agentKey: "voice", needs: ["script.generate"], approval: true },
            { key: "video.assemble", agentKey: "video", needs: ["voice.generate"], approval: true },
            { key: "publish.prepare_package", agentKey: "distribution", needs: ["video.assemble"], approval: true },
          ],
        }),
      },
      {
        key: "dubb_multilang",
        name: "Multilingual dubbing",
        description: "Transcribe → translate (glossary) → review → dub → subtitles.",
        definition: JSON.stringify({
          steps: [
            { key: "transcribe.audio", agentKey: "localization", needs: [] },
            { key: "localize.translate", agentKey: "localization", needs: ["transcribe.audio"], approval: true },
            { key: "localize.dub", agentKey: "localization", needs: ["localize.translate"] },
          ],
        }),
      },
      {
        key: "repurpose_shorts",
        name: "Shorts repurposing",
        description: "Long-form → clips → captions → review → export.",
        definition: JSON.stringify({
          steps: [
            { key: "repurpose.generate_clips", agentKey: "repurpose", needs: [], approval: true },
            { key: "video.assemble", agentKey: "video", needs: ["repurpose.generate_clips"] },
          ],
        }),
      },
    ].map((w) => ({ workspaceId: workspace.id, key: w.key, name: w.name, description: w.description, definition: w.definition })),
  });

  await prisma.scheduledReport.create({
    data: {
      workspaceId: workspace.id,
      kind: "morning_brief",
      hourLocal: 7,
      minuteLocal: 0,
      timezone: workspace.timezone,
      channels: JSON.stringify(["in_app"]),
      enabled: true,
    },
  });

  console.log(`Seed complete: ${email} / workspace "${wsName}" (fixture data clearly labeled).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
