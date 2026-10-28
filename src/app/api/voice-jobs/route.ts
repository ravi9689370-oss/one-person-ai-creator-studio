import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody, audit } from "@/server/api";

const createSchema = z.object({
  scriptVersionId: z.string().min(1, "Pick a script version."),
  voiceProfileId: z.string().optional().or(z.literal("")),
  language: z.string().trim().min(2).max(8).default("en"),
  style: z.string().trim().max(200).optional().or(z.literal("")),
  requestApproval: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;

  const sv = await prisma.scriptVersion.findFirst({
    where: { id: body.data.scriptVersionId },
    include: { script: true },
  });
  if (!sv || sv.script.workspaceId !== auth.ctx.workspaceId) return fail(404, "not_found", "Script version not found.");

  const idempotencyKey = `voice:${sv.id}:${auth.ctx.userId}`;
  const existing = await prisma.voiceJob.findFirst({ where: { idempotencyKey, status: { in: ["queued", "running", "succeeded"] } } });
  if (existing) return ok({ jobId: existing.id, reused: true });

  // submit through the agent pipeline for consistent tracking
  const { createTask, drainQueueInline } = await import("@/server/agents/dispatch");
  const { id: taskId } = await createTask({
    workspaceId: auth.ctx.workspaceId,
    type: "voice.generate",
    input: {
      message: `voice for ${sv.script.title}`,
      scriptVersionId: sv.id,
      voiceProfileId: body.data.voiceProfileId || undefined,
      language: body.data.language,
      style: body.data.style || undefined,
    },
    actorId: auth.ctx.userId,
    idempotencyKey,
    subject: `Voice: ${sv.script.title} v${sv.version}`,
  });
  const run = await drainQueueInline(auth.ctx.workspaceId, taskId);
  const job = await prisma.voiceJob.findUnique({ where: { idempotencyKey } });
  const outputRefs = job?.outputAssetId
    ? { audio: `media:${job.outputAssetId}` }
    : undefined;
  await audit(auth.ctx, "voice.generate", "agent_task", taskId, { scriptVersionId: sv.id });
  return ok({ taskId, runStatus: run.status, jobId: job?.id ?? null, outputRefs }, { status: 202 });
}
