/**
 * Agent handlers. Each handler:
 *  1. runs against structured input,
 *  2. verifies produced artifacts before reporting success,
 *  3. labels mock/dev-fixture output with isMock so the UI can badge it.
 */
import path from "node:path";
import { prisma } from "@/lib/db";
import { providerEnv } from "@/lib/env";
import { createApprovalRequest } from "@/server/approvals";
import { notify } from "@/server/notifications";
import { putObject, newObjectKey, getObject, storageOperational } from "@/server/storage";
import { callLlm } from "@/server/providers/llm";
import { synthesizeSpeech } from "@/server/providers/tts";
import { transcribe } from "@/server/providers/transcription";
import { generateImage } from "@/server/providers/image";
import { finalizeTask } from "@/server/agents/director";
import type { AgentTask } from "@prisma/client";
import { SUPPORTED_LANGUAGES } from "@/lib/utils";

type Ctx = { workspaceId: string };

async function saveMediaAsset(
  ctx: Ctx,
  input: { title: string; kind: string; data: Buffer; mime: string; source: string; meta?: Record<string, unknown>; note?: string }
): Promise<string> {
  if (!storageOperational()) throw new Error("Storage adapter is not writable.");
  const key = newObjectKey(`${input.title.slice(0, 40)}.${input.mime.split("/")[1] ?? "bin"}`, input.kind);
  const stored = await putObject(key, input.data, ctx.workspaceId);
  const asset = await prisma.mediaAsset.create({
    data: {
      workspaceId: ctx.workspaceId,
      kind: input.kind,
      title: input.title,
      path: stored.path,
      mime: input.mime,
      sizeBytes: stored.sizeBytes,
      source: input.source,
      meta: JSON.stringify(input.meta ?? (input.note ? { fixtureNote: input.note } : {})),
    },
  });
  return asset.id;
}

function readInput(task: AgentTask): Record<string, unknown> {
  try {
    const parsed = JSON.parse(task.inputRefs ?? "{}");
    return (parsed.message ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function configSummary(): { mock: boolean; provider: string } {
  const env = providerEnv();
  const real = Boolean(env.anthropicApiKey || env.openaiApiKey);
  return { mock: !real, provider: real ? "configured-llm" : "development-fixture" };
}

export async function runTaskById(taskId: string): Promise<void> {
  const task = await prisma.agentTask.findUnique({ where: { id: taskId } });
  if (!task) return;
  const ctx = { workspaceId: task.workspaceId };
  try {
    switch (true) {
      case task.type.startsWith("script"):
        await scriptTask(task, ctx);
        break;
      case task.type === "voice.generate":
        await voiceTask(task, ctx);
        break;
      case task.type === "transcribe.audio":
        await transcribeTask(task, ctx);
        break;
      case task.type.startsWith("localize"):
        await localizeTask(task, ctx);
        break;
      case task.type === "repurpose.generate_clips":
        await repurposeTask(task, ctx);
        break;
      case task.type === "thumbnail.concept":
        await thumbnailTask(task, ctx);
        break;
      case task.type === "video.assemble":
        await videoAssembleTask(task, ctx);
        break;
      case task.type === "progress.noop":
        await finalizeTask(task.id, { status: "succeeded", summary: "No-op acknowledged." }, task.workspaceId);
        break;
      default:
        await researchAndIdeaTask(task, ctx);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    const attempts = task.attempts;
    if (attempts >= task.maxAttempts) {
      await finalizeTask(task.id, { status: "failed", summary: "Task failed.", error: msg }, task.workspaceId);
      await notify.publish(task.workspaceId, {
        type: "failure",
        title: "Agent task failed",
        body: `${task.type}: ${msg.slice(0, 200)}`,
        link: `/studio/tasks/${task.id}`,
      });
    } else {
      await prisma.agentTask.update({ where: { id: task.id }, data: { status: "queued", error: msg } });
    }
  }
}

async function researchAndIdeaTask(task: AgentTask, ctx: Ctx): Promise<void> {
  const input = readInput(task);
  const prompt = String(input.message ?? input.subject ?? "general research");
  const cfg = configSummary();
  const res = await callLlm({
    system: "You are a research/strategy agent for a creator studio. Produce concise, referenced-style briefs. JSON output.",
    user: `Brief request: ${prompt}\nReturn JSON {summary, key_points[], open_questions[], source_type_hints[]}`,
  });
  const topic = await prisma.contentTopic.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: prompt.slice(0, 120) || "Research brief",
      status: "researched",
      notes: res.text.slice(0, 4000) + (cfg.mock ? " [DEVELOPMENT FIXTURE LLM]" : ""),
    },
  });
  await finalizeTask(
    task.id,
    {
      status: "succeeded",
      summary: `Research brief created for "${prompt.slice(0, 80)}"`,
      outputRefs: { topic: `script:${topic.id}` },
      isMock: cfg.mock,
    },
    ctx.workspaceId
  );
}

async function scriptTask(task: AgentTask, ctx: Ctx): Promise<void> {
  const input = readInput(task);
  const brand = await prisma.brandProfile.findUnique({ where: { workspaceId: ctx.workspaceId } });
  const personaRow = await prisma.audiencePersona.findFirst({ where: { brandProfileId: brand?.id } });
  const persona = (input.persona ?? personaRow?.name ?? "core audience") as string;
  const message = String(input.message ?? "topic from intake");
  const payload = await callLlm({
    system:
      `You are the Script Agent. Write in the creator's brand voice: "${brand?.voice ?? ""}" (tone: ${brand?.tone ?? ""}). Avoid hype claims. Target persona: ${persona}. ` +
      "Return JSON {hook, sections:[{heading, beats}], cta} as valid JSON.",
    user: `Write a ${input.format === "short_form" ? "45-second short-form" : "8-min long-form"} script about: ${message}\nReturn JSON.`,
    mock: Boolean(input.mock) || false,
  });
  const script = await prisma.script.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: `Draft: ${message.slice(0, 80)}`,
      format: String(input.format ?? "long_form"),
      status: "pending_approval",
      hook: extractField(payload.text, "hook") ?? textMonad(payload.text, 2),
      createdById: task.agentKey + ":agent",
    },
  });
  const version = await prisma.scriptVersion.create({
    data: {
      scriptId: script.id,
      version: 1,
      body: formatScriptBody(payload.text),
      tone: brand?.tone ?? null,
      targetMin: input.format === "short_form" ? 1 : 8,
      createdById: task.agentKey + ":agent",
    },
  });
  await prisma.script.update({ where: { id: script.id }, data: { currentVersion: 1 } });
  const approval = await createApprovalRequest(ctx.workspaceId, {
    objectType: "script",
    objectId: script.id,
    title: `Script for approval: ${script.title}`,
    context: { scriptId: script.id, versionId: version.id, isMock: payload.mode === "mock" },
    requestedById: null,
  });
  await prisma.agentTask.update({ where: { id: task.id }, data: { approvalRequestId: approval.id } });
  await finalizeTask(
    task.id,
    {
      status: "waiting_for_approval",
      summary: `Script generated (${payload.mode === "mock" ? "development fixture" : payload.provider}). Awaiting approval.`,
      outputRefs: { script: `script:${script.id}` },
      isMock: payload.mode === "mock",
    },
    ctx.workspaceId
  );
}

function extractField(jsonish: string, field: string): string | null {
  const re = new RegExp('"?(?:' + field + ')"?\\s*[:=]\\s*"?([^"\\n]+)"?');
  const m = re.exec(jsonish);
  return m ? m[1].slice(0, 200) : null;
}
function textMonad(s: string, n: number): string | null {
  if (!s) return null;
  const lines = s.split("\n").filter(Boolean);
  const idx = lines.findIndex((l) => /hook/i.test(l));
  return (idx >= 0 ? lines[idx + 1] : lines[n]) ?? null;
}
function formatScriptBody(raw: string): string {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  if (/^\\{/.test(cleaned)) {
    try {
      const j = JSON.parse(cleaned) as { hook?: string; sections?: { heading: string; beats: string }[]; cta?: string };
      const body = [j.hook ? `Hook: ${j.hook}` : "", ...(j.sections ?? []).map((s) => `## ${s.heading}\\n${s.beats}`), j.cta ? `CTA: ${j.cta}` : ""].filter(Boolean).join("\\n\\n");
      return body || cleaned;
    } catch {
      return cleaned;
    }
  }
  return cleaned;
}

async function voiceTask(task: AgentTask, ctx: Ctx): Promise<void> {
  const input = readInput(task);
  const scriptVersionId = typeof input.scriptVersionId === "string" ? input.scriptVersionId : null;
  if (!scriptVersionId) throw new Error("voice.generate requires scriptVersionId");
  const sv = await prisma.scriptVersion.findFirst({
    where: { id: scriptVersionId },
    include: { script: true },
  });
  if (!sv || sv.script.workspaceId !== ctx.workspaceId) throw new Error("Script version not found in workspace");
  const voiceProfile = await prisma.voiceProfile.findFirst({
    where: { workspaceId: ctx.workspaceId, ...(typeof input.voiceProfileId === "string" ? { id: input.voiceProfileId } : {}) },
  });
  const job = await prisma.voiceJob.create({
    data: {
      workspaceId: ctx.workspaceId,
      scriptVersionId,
      provider: "pending",
      voiceId: voiceProfile?.externalVoiceId ?? "from-config",
      language: String(input.language ?? sv.script.language ?? "en"),
      style: typeof input.style === "string" ? input.style : null,
      status: "running",
    },
  });
  const speech = await synthesizeSpeech({
    text: sv.body.slice(0, 4500),
    voiceId: job.voiceId ?? undefined,
    language: job.language,
  });
  const assetId = await saveMediaAsset(ctx, {
    title: `Voice: ${sv.script.title} v${sv.version}`,
    kind: "audio",
    data: speech.audio,
    mime: speech.mime,
    source: "generated",
    note: speech.mockNote,
  });
  // verify the artifact actually exists and is nonempty before success
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset || (asset.sizeBytes ?? 0) < 100) throw new Error("Generated audio failed verification");
  await prisma.voiceJob.update({
    where: { id: job.id },
    data: {
      status: "succeeded",
      outputAssetId: assetId,
      provider: speech.provider,
      costCents: speech.mode === "mock" ? 0 : null,
      finishedAt: new Date(),
    },
  });
  await createApprovalRequest(ctx.workspaceId, {
    objectType: "voice",
    objectId: job.id,
    title: `Review voiceover: ${sv.script.title} v${sv.version}`,
    context: { voiceJobId: job.id, assetId, isMock: speech.mode === "mock", note: speech.mockNote ?? "" },
  });
  await finalizeTask(
    task.id,
    {
      status: "waiting_for_approval",
      summary: `Speech generated via ${speech.provider}${speech.mode === "mock" ? " (DEVELOPMENT FIXTURE)" : ""}. Awaiting review.`,
      outputRefs: { audio: `media:${assetId}` },
      isMock: speech.mode === "mock",
    },
    ctx.workspaceId
  );
}

async function transcribeTask(task: AgentTask, ctx: Ctx): Promise<void> {
  const input = readInput(task);
  const assetId = String(input.assetId ?? "");
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, workspaceId: ctx.workspaceId } });
  if (!asset || !asset.path) throw new Error("Source audio asset not found");
  const buf = await getObject(asset.path);
  if (!buf || buf.length === 0) throw new Error("Source audio file missing in storage");
  const out = await transcribe({ audio: buf, mime: asset.mime ?? "audio/wav", fileName: path.basename(asset.path), language: (input.language as string) ?? undefined });
  const job = await prisma.transcriptionJob.create({
    data: { workspaceId: ctx.workspaceId, sourceAssetId: assetId, status: "succeeded", text: out.text, provider: out.provider, finishedAt: new Date() },
  });
  await prisma.mediaAsset.update({ where: { id: assetId }, data: { transcript: out.text } });
  // If the asset is attached to a voice-note document, persist its transcript there too.
  const linkedDocs = await prisma.knowledgeDocument.findMany({ where: { assetId, workspaceId: ctx.workspaceId }, select: { id: true } });
  for (const doc of linkedDocs) {
    await prisma.knowledgeDocument.update({
      where: { id: doc.id },
      data: { content: out.mode === "mock" ? `[DEVELOPMENT FIXTURE TRANSCRIPT]\n${out.text}` : out.text },
    });
  }
  await finalizeTask(
    task.id,
    { status: "succeeded", summary: out.mockNote ? `Fixture transcription stored (${out.mockNote})` : "Transcription verified.", outputRefs: { transcriptJob: `media:${job.id}` }, isMock: out.mode === "mock" },
    ctx.workspaceId
  );
}

async function localizeTask(task: AgentTask, ctx: Ctx): Promise<void> {
  const input = readInput(task);
  const projectId = String(input.projectId ?? "");
  const language = String(input.language ?? "");
  if (!SUPPORTED_LANGUAGES.includes(language as (typeof SUPPORTED_LANGUAGES)[number])) {
    throw new Error(`Language ${language} is not in the supported set.`);
  }
  const project = await prisma.localizationProject.findFirst({ where: { id: projectId, workspaceId: ctx.workspaceId } });
  if (!project) throw new Error("Localization project not found");

  const glossary = await prisma.translationGlossary.findUnique({
    where: { workspaceId_language: { workspaceId: ctx.workspaceId, language } },
  });
  if (task.type === "localize.translate") {
    let source = String(input.text ?? "");
    if (!source) {
      const sv = project.sourceScriptId
        ? await prisma.scriptVersion.findFirst({ where: { scriptId: project.sourceScriptId }, orderBy: { version: "desc" } })
        : null;
      source = sv?.body ?? "";
    }
    if (!source) throw new Error("No source text to translate");
    const payload = await callLlm({
      system: `Translate the following to ${language}. Use glossary terms when present. JSON {translation}`,
      user: `GLOSSARY: ${glossary?.terms ?? "none"}\nTEXT: ${source.slice(0, 4000)}`,
    });
    const translated = extractField(payload.text, "translation") ?? payload.text;
    const variant = await (async () => {
      const existing = await prisma.localizationVariant.findUnique({
        where: { projectId_language: { projectId, language } },
      });
      if (existing) {
        return prisma.localizationVariant.update({
          where: { id: existing.id },
          data: { translatedText: translated, translationJobId: task.id, status: "in_review", lipSyncAvailable: project.playbackType === "lipsync" },
        });
      }
      return prisma.localizationVariant.create({
        data: {
          projectId,
          language,
          status: "in_review",
          translatedText: translated,
          translationJobId: task.id,
          lipSyncAvailable: project.playbackType === "lipsync",
        },
      });
    })();
    await createApprovalRequest(ctx.workspaceId, {
      objectType: "localization",
      objectId: variant.id,
      title: `Review ${language} translation (project ${project.name})`,
      context: { variantId: variant.id, isMock: payload.mode === "mock", glossaryApplied: Boolean(glossary) },
    });
    await finalizeTask(
      task.id,
      { status: "waiting_for_approval", summary: `Translation to ${language} ready for review.`, isMock: payload.mode === "mock" },
      ctx.workspaceId
    );
  } else if (task.type === "localize.dub") {
    const variant = await prisma.localizationVariant.findUnique({ where: { projectId_language: { projectId, language } } });
    if (!variant?.translatedText) throw new Error("Translation must be approved before dubbing");
    if (variant.status !== "approved") throw new Error("Variant not approved for dubbing yet");
    const speech = await synthesizeSpeech({ text: variant.translatedText.slice(0, 4500), language, voiceId: typeof input.voiceProfileId === "string" ? input.voiceProfileId : undefined });
    const assetId = await saveMediaAsset(ctx, {
      title: `Dubbed audio (${language}): ${project.name}`,
      kind: "audio",
      data: speech.audio,
      mime: speech.mime,
      source: "generated",
      note: speech.mockNote,
    });
    const subtitle = {
      entries: variant.translatedText.split(/\\n\\n|\\n/).slice(0, 30).map((s, i) => ({ seq: i + 1, start: i * 4, end: i * 4 + 4, text: s.trim() })),
      language,
    };
    const subAssetId = await saveMediaAsset(ctx, {
      title: `Subtitles (${language}): ${project.name}`,
      kind: "document",
      data: Buffer.from(toSrt(subtitle.entries), "utf8"),
      mime: "application/x-subrip",
      source: "generated",
    });
    await prisma.localizationVariant.update({
      where: { id: variant.id },
      data: { status: "dubbed", dubJobId: task.id, subtitleAssetId: subAssetId },
    });
    await finalizeTask(
      task.id,
      {
        status: "succeeded",
        summary: `Dubbed audio${speech.mode === "mock" ? " (DEVELOPMENT FIXTURE)" : ""} + subtitles generated for ${language}.`,
        outputRefs: { audio: `media:${assetId}`, subtitles: `media:${subAssetId}` },
        isMock: speech.mode === "mock",
      },
      ctx.workspaceId
    );
  }
}

function toSrt(entries: { seq: number; start: number; end: number; text: string }[]): string {
  return entries
    .map((e) => `${e.seq}\\n${fmtSrtTime(e.start)} --> ${fmtSrtTime(e.end)}\\n${e.text}\\n`)
    .join("\\n");
  function fmtSrtTime(sec: number): string {
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(Math.floor(sec % 60)).padStart(2, "0");
    const ms = String(Math.floor((sec % 1) * 1000)).padStart(3, "0");
    return `${h}:${m}:${s},${ms}`;
  }
}

async function repurposeTask(task: AgentTask, ctx: Ctx): Promise<void> {
  const input = readInput(task);
  const sourceAssetId = String(input.sourceAssetId ?? "");
  const asset = await prisma.mediaAsset.findFirst({ where: { id: sourceAssetId, workspaceId: ctx.workspaceId, kind: "video" } });
  if (!asset) throw new Error("Source video asset not found");
  const duration = Number(input.durationSec ?? asset.durationSec ?? 600);
  const targetClips = Math.min(Math.max(Number(input.targetClips ?? 10), 1), 20);
  const targetDur = Math.max(Number(input.targetDurationSec ?? 45), 20);
  const job = await prisma.repurposeJob.create({
    data: {
      workspaceId: ctx.workspaceId,
      sourceAssetId,
      targetClips,
      targetDurationSec: targetDur,
      language: String(input.language ?? "en"),
      projectId: typeof input.projectId === "string" ? input.projectId : null,
      status: "running",
      startedAt: new Date(),
    },
  });
  const payload = await callLlm({
    system: "You are the Repurposing Agent. Given a transcript/segments summary, propose clip candidates. JSON {clips:[{title, description, startSec, endSec}]}",
    user: `Duration: ${duration}s. Target clips: ${targetClips} (target, not guaranteed). Propose candidates with tight hooks.`,
  });
  type Clip = { title: string; description?: string; startSec?: number; endSec?: number };
  let clips: Clip[] = [];
  try {
    const parsed = JSON.parse(payload.text.replace(/^[^{]*|[^}]*$/g, "")) as { clips?: Clip[] };
    clips = (parsed.clips ?? []).slice(0, targetClips);
  } catch {
    clips = [];
  }
  if (clips.length === 0) {
    // deterministic candidates spread across the timeline as a labeled fallback
    const seg = Math.max(targetDur, Math.floor(duration / targetClips));
    clips = Array.from({ length: targetClips }, (_, i) => ({
      title: `Candidate ${i + 1}`,
      startSec: i * seg,
      endSec: Math.min(i * seg + targetDur, duration),
    }));
  }
  const created = await prisma.$transaction(
    clips.map((c, i) =>
      prisma.generatedClip.create({
        data: {
          repurposeJobId: job.id,
          title: c.title || `Candidate ${i + 1}`,
          description: c.description ?? null,
          startSec: Math.max(0, Number(c.startSec ?? i * targetDur)),
          endSec: Math.max(1, Number(c.endSec ?? i * targetDur + targetDur)),
          status: "candidate",
        },
      })
    )
  );
  void created;
  await prisma.repurposeJob.update({
    where: { id: job.id },
    data: { status: "succeeded", finishedAt: new Date() },
  });
  await finalizeTask(
    task.id,
    {
      status: "succeeded",
      summary: `${clips.length} clip candidates created (target was ${targetClips}). Clips stay in "candidate" state until rendered by a configured media pipeline.`,
      isMock: payload.mode === "mock",
    },
    ctx.workspaceId
  );
}

async function thumbnailTask(task: AgentTask, ctx: Ctx): Promise<void> {
  const input = readInput(task);
  const payload = await callLlm({
    system: "You are the Thumbnail Agent. Produce thumbnail concept variants. JSON {concepts:[{text, prompt}]}",
    user: `Video: ${String(input.message ?? input.title ?? "video")}. Produce 2 contrasting concepts (curiosity vs clarity).`,
  });
  let concepts: { text: string; prompt: string }[] = [];
  try {
    const parsed = JSON.parse(payload.text.replace(/^[^{]*|[^}]*$/g, "")) as { concepts?: { text: string; prompt: string }[] };
    concepts = parsed.concepts ?? [];
  } catch {
    concepts = [];
  }
  if (concepts.length < 2) {
    concepts = [
      { text: "Curiosity angle", prompt: `bold silhouette, high contrast, one word plea: ${String(input.message ?? "")}` },
      { text: "Clarity angle", prompt: `clean stat overlay, bright face cutout: ${String(input.message ?? "")}` },
    ];
  }
  const createdIds: string[] = [];
  const group = `grp-${task.id.slice(0, 8)}`;
  for (const c of concepts.slice(0, 2)) {
    const img = await generateImage({ prompt: c.prompt });
    const assetId = await saveMediaAsset(ctx, {
      title: `Thumbnail: ${c.text}`,
      kind: "image",
      data: img.image,
      mime: img.mime,
      source: "generated",
      note: img.mockNote,
    });
    const thumb = await prisma.thumbnail.create({
      data: {
        workspaceId: ctx.workspaceId,
        concept: c.text,
        textOverlay: c.text,
        assetId,
        provider: img.provider,
        status: "generated",
        variantGroup: group,
      },
    });
    createdIds.push(thumb.id);
  }
  await finalizeTask(
    task.id,
    {
      status: "succeeded",
      summary: `2 thumbnail variants created${payload.mode === "mock" ? " (DEVELOPMENT FIXTURE images)" : ""}.`,
      outputRefs: { a: createdIds[0], b: createdIds[1] },
      isMock: payload.mode === "mock",
    },
    ctx.workspaceId
  );
  void createdIds;
}

async function videoAssembleTask(task: AgentTask, ctx: Ctx): Promise<void> {
  // Assemble-only: package approved assets into a validated storyboard plan.
  const input = readInput(task);
  const scriptVersionId = typeof input.scriptVersionId === "string" ? input.scriptVersionId : null;
  const voiceAssetId = typeof input.voiceAssetId === "string" ? input.voiceAssetId : null;
  if (!scriptVersionId) throw new Error("video.assemble requires scriptVersionId");
  const sv = await prisma.scriptVersion.findFirst({ where: { id: scriptVersionId }, include: { script: true } });
  if (!sv || sv.script.workspaceId !== ctx.workspaceId) throw new Error("Script version not found");
  if (sv.script.status !== "approved") throw new Error("Script must be approved before video assembly");
  if (voiceAssetId) {
    const audio = await prisma.mediaAsset.findFirst({ where: { id: voiceAssetId, kind: "audio", workspaceId: ctx.workspaceId } });
    if (!audio) throw new Error("Voiceover asset not found");
  }
  const plan = [
    { shot: 1, assetRef: voiceAssetId ? `media:${voiceAssetId}` : "voiceover:pending", durationSec: 30, note: "cold open" },
    { shot: 2, assetRef: "broll:library", durationSec: 60, note: "workflow demo" },
    { shot: 3, assetRef: "outro:cta", durationSec: 20, note: "call to action" },
  ];
  const job = await prisma.videoJob.create({
    data: {
      workspaceId: ctx.workspaceId,
      scriptVersionId,
      voiceJobId: typeof input.voiceJobId === "string" ? input.voiceJobId : null,
      provider: "assemble-only",
      plan: JSON.stringify(plan),
      status: "succeeded",
      finishedAt: new Date(),
      outputAssetId: null,
      captionLanguage: "en",
    },
  });
  await createApprovalRequest(ctx.workspaceId, {
    objectType: "video",
    objectId: job.id,
    title: `Review assembled production package: ${sv.script.title}`,
    context: { videoJobId: job.id, assembleOnly: true, note: "Render step requires a configured video provider (see Integrations)." },
  });
  await finalizeTask(
    task.id,
    {
      status: "waiting_for_approval",
      summary: "Assemble-only package built. Real rendering requires a configured video provider - job records the storyboard and stays explicit about that boundary.",
      outputRefs: { plan: "", notes: `task:${task.id}` },
    },
    ctx.workspaceId
  );
}

void notify;
