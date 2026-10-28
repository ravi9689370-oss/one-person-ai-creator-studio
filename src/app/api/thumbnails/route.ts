import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";

/**
 * Thumbnail pipeline: concepts via Thumbnail Agent, experiments with manual
 * metric capture (clearly labeled as manual until a platform connection
 * ingests real performance data).
 */
export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const raw = await req.json().catch(() => null);
  const schema = z.object({
    action: z.enum(["concepts", "experiment"]),
    title: z.string().trim().min(2).max(200).optional(),
    variantAId: z.string().optional(),
    variantBId: z.string().optional(),
    name: z.string().trim().max(120).optional(),
  });
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid payload.");

  if (parsed.data.action === "experiment") {
    if (!parsed.data.variantAId || !parsed.data.variantBId) return fail(422, "variants_required", "Two thumbnail variants are required for an experiment.");
    const a = await prisma.thumbnail.findFirst({ where: { id: parsed.data.variantAId, workspaceId: auth.ctx.workspaceId } });
    const b = await prisma.thumbnail.findFirst({ where: { id: parsed.data.variantBId, workspaceId: auth.ctx.workspaceId } });
    if (!a || !b) return fail(404, "not_found", "Thumbnail variants not found.");
    const exp = await prisma.thumbnailExperiment.create({
      data: {
        workspaceId: auth.ctx.workspaceId,
        name: parsed.data.name ?? `${a.concept} vs ${b.concept}`,
        variantAId: a.id,
        variantBId: b.id,
        status: "running",
        results: JSON.stringify({ a: { impressions: 0 }, b: { impressions: 0 }, note: "No performance data yet - measures only real recorded metrics." }),
      },
    });
    await audit(auth.ctx, "thumbnail.experiment.create", "thumbnail_experiment", exp.id);
    return ok({ experimentId: exp.id }, { status: 201 });
  }

  if (!parsed.data.title) return fail(422, "title_required", "Provide the video/topic title for concepts.");
  const { createTask, drainQueueInline } = await import("@/server/agents/dispatch");
  const { id: taskId } = await createTask({
    workspaceId: auth.ctx.workspaceId,
    type: "thumbnail.concept",
    input: { message: parsed.data.title },
    actorId: auth.ctx.userId,
  });
  const run = await drainQueueInline(auth.ctx.workspaceId, taskId, 30_000);
  return ok({ taskId, status: run.status }, { status: 202 });
}
