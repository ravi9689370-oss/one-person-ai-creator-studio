/**
 * Voice notes: upload audio -> optional automatic transcription task.
 * Noise reduction is a provider boundary (Krisp desktop) noted in UI copy.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";
import { checkUpload, putObject, newObjectKey } from "@/server/storage";
import { transcriptionConfigured } from "@/server/providers/transcription";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const docs = await prisma.knowledgeDocument.findMany({
    where: { workspaceId: auth.ctx.workspaceId, kind: "voice_note" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, content: true, assetId: true, createdAt: true },
  });
  const { configured, provider } = transcriptionConfigured();
  return ok({
    items: docs,
    transcription: { status: configured ? "configured" : "mock", provider, note: configured ? "Ready for real transcription." : "Development fixture transcription (clearly labeled)." },
    noiseReduction: "Krisp runs on the desktop side; see docs/integrations.md for the handoff workflow.",
  });
}

type Label = string;
const IGNORE: Label = "form";

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  let form: FormData;
  try {
    form = await req.formData();
  } catch (_e) {
    void _e;
    return fail(400, "invalid_form", "multipart/form-data expected.");
  }
  void IGNORE;
  const file = form.get("file");
  if (!(file instanceof File)) return fail(422, "no_file", "An audio 'file' field is required.");
  const title = (form.get("title") as string) || "Voice note";
  const transcribeNow = (form.get("transcribe") ?? "true") === "true";
  const check = checkUpload(file.type, file.size);
  if (!check.ok || check.kind !== "audio") return fail(422, "upload_rejected", check.ok ? "Only audio files are supported here." : check.reason);

  const buf = Buffer.from(await file.arrayBuffer());
  const key = newObjectKey(file.name, "audio");
  const stored = await putObject(key, buf, auth.ctx.workspaceId);
  const asset = await prisma.mediaAsset.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      kind: "audio",
      title: title.slice(0, 120),
      path: stored.path,
      mime: file.type,
      sizeBytes: stored.sizeBytes,
      durationSec: Number(form.get("durationSec")) || null,
      source: "upload",
      meta: JSON.stringify({ uploadedAs: "voice_note" }),
    },
  });

  const doc = await prisma.knowledgeDocument.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      title: title.slice(0, 120),
      kind: "voice_note",
      content: "",
      assetId: asset.id,
    },
  });

  let taskId: string | null = null;
  if (transcribeNow) {
    const { createTask, drainQueueInline } = await import("@/server/agents/dispatch");
    const { id } = await createTask({
      workspaceId: auth.ctx.workspaceId,
      type: "transcribe.audio",
      input: { message: `transcribe ${title}`, assetId: asset.id, language: (form.get("language") as string) || "en" },
      actorId: auth.ctx.userId,
    });
    taskId = id;
    await drainQueueInline(auth.ctx.workspaceId, id, 30_000);
    const docAfter = await prisma.knowledgeDocument.findUnique({ where: { id: doc.id }, select: { content: true } });
    return ok({ assetId: asset.id, documentId: doc.id, taskId, transcript: docAfter?.content ?? "" }, { status: 201 });
  }
  await audit(auth.ctx, "voice_note.upload", "media_asset", asset.id);
  return ok({ assetId: asset.id, documentId: doc.id, taskId }, { status: 201 });
}
