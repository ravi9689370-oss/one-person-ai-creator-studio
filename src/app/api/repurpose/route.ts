import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";

/** Clip generation + per-clip review status updates. */
export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const schema = z.object({
    sourceAssetId: z.string().min(1, "Pick a source video from the media library."),
    projectId: z.string().optional(),
    targetClips: z.number().int().min(1).max(20).default(10),
    targetDurationSec: z.number().int().min(20).max(180).default(45),
    language: z.string().trim().min(2).max(8).default("en"),
  });
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid payload.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });

  const asset = await prisma.mediaAsset.findFirst({ where: { id: parsed.data.sourceAssetId, workspaceId: auth.ctx.workspaceId, kind: "video" } });
  if (!asset) return fail(404, "source_missing", "Source video not found in the media library.");

  const { createTask, drainQueueInline } = await import("@/server/agents/dispatch");
  const { id: taskId } = await createTask({
    workspaceId: auth.ctx.workspaceId,
    type: "repurpose.generate_clips",
    input: { ...parsed.data, sourceAssetId: asset.id, message: `clips from ${asset.title}` },
    actorId: auth.ctx.userId,
  });
  const run = await drainQueueInline(auth.ctx.workspaceId, taskId, 30_000);
  const job = await prisma.repurposeJob.findFirst({ where: { workspaceId: auth.ctx.workspaceId }, orderBy: { createdAt: "desc" } });
  await audit(auth.ctx, "repurpose.generate", "repurpose_job", job?.id ?? null, { sourceAssetId: asset.id });
  return ok({ taskId, status: run.status, jobId: job?.id ?? null }, { status: 202 });
}

const patchClip = z.object({
  clipId: z.string().min(1),
  status: z.enum(["candidate", "ready", "verified", "rejected", "failed"]).optional(),
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const parsed = patchClip.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid payload.");
  const clip = await prisma.generatedClip.findFirst({
    where: { id: parsed.data.clipId, job: { workspaceId: auth.ctx.workspaceId } },
  });
  if (!clip) return fail(404, "not_found", "Clip not found.");
  if (parsed.data.status === "verified") {
    return fail(409, "verification_system_only", "Verification is reserved for rendered artifacts: a clip can only become verified when a media pipeline (worker renderer, or a connected provider) produces and checks a playable file. Mark 'ready' after manual review instead.");
  }
  const updated = await prisma.generatedClip.update({
    where: { id: clip.id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.status && ["ready", "rejected"].includes(parsed.data.status) ? { verifiedAt: parsed.data.status === "ready" ? null : null } : {}),
    },
  });
  void updated;
  await audit(auth.ctx, "clip.review", "generated_clip", clip.id, { status: parsed.data.status });
  return ok({ ok: true });
}
