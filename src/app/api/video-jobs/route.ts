/**
 * Video production: assemble-only packaging verified against approved assets.
 * Real rendering requires a configured video provider (honest boundary).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody, audit } from "@/server/api";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const jobs = await prisma.videoJob.findMany({
    where: { workspaceId: auth.ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, scriptVersionId: true, provider: true, status: true, outputAssetId: true, captionAssetId: true, plan: true, error: true, finishedAt: true, createdAt: true },
  });
  return ok({ jobs });
}

const createSchema = z.object({
  scriptVersionId: z.string().min(1),
  voiceAssetId: z.string().optional().or(z.literal("")),
  voiceJobId: z.string().optional().or(z.literal("")),
  brollAssetIds: z.array(z.string()).max(20).default([]),
  aspect: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;

  const sv = await prisma.scriptVersion.findFirst({ where: { id: body.data.scriptVersionId }, include: { script: true } });
  if (!sv || sv.script.workspaceId !== auth.ctx.workspaceId) return fail(404, "not_found", "Script version not found.");
  if (sv.script.status !== "approved") return fail(409, "script_not_approved", "The script must be approved before video assembly.");
  if (body.data.voiceAssetId) {
    const audio = await prisma.mediaAsset.findFirst({ where: { id: body.data.voiceAssetId, kind: "audio", workspaceId: auth.ctx.workspaceId } });
    if (!audio) return fail(400, "invalid_voice", "Voiceover asset not found.");
  }

  const plan = [
    { shot: 1, assetRef: body.data.voiceAssetId ? `media:${body.data.voiceAssetId}` : null, kind: "voiceover", note: "opening" },
    ...body.data.brollAssetIds.slice(0, 10).map((id, i) => ({ shot: i + 2, assetRef: `media:${id}`, kind: "b_roll", note: "b-roll" })),
    { shot: body.data.brollAssetIds.length + 2, assetRef: null, kind: "cta", note: "call to action" },
  ];

  const job = await prisma.videoJob.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      scriptVersionId: sv.id,
      voiceJobId: body.data.voiceJobId || null,
      provider: "assemble-only",
      plan: JSON.stringify(plan),
      captionLanguage: sv.script.language,
      status: "running",
      aspect: body.data.aspect,
    },
  });

  await prisma.videoJob.update({ where: { id: job.id }, data: { status: "succeeded", finishedAt: new Date() } });
  const { createApprovalRequest } = await import("@/server/approvals");
  await createApprovalRequest(
    auth.ctx.workspaceId,
    {
      objectType: "video",
      objectId: job.id,
      title: `Review production package: ${sv.script.title}`,
      context: { videoJobId: job.id, assembleOnly: true, aspect: body.data.aspect, note: "Render step requires a configured video provider (see Integrations); this package records the storyboard plan." },
    },
    auth.ctx
  );
  await audit(auth.ctx, "video.assemble", "video_job", job.id, { scriptVersionId: sv.id, aspect: body.data.aspect });
  return ok({ jobId: job.id, assembleOnly: true }, { status: 201 });
}
