/**
 * Workflow execution: run a registered workflow definition. Execution records
 * the validated step plan in its input so advanceWorkflow() is self-contained.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const [definitions, executions] = await Promise.all([
    prisma.workflowDefinition.findMany({ where: { workspaceId: auth.ctx.workspaceId }, orderBy: { key: "asc" } }),
    prisma.workflowExecution.findMany({
      where: { workspaceId: auth.ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { workflow: { select: { name: true, key: true } } },
    }),
  ]);
  return ok({ definitions, executions });
}

const runSchema = z.object({
  workflowKey: z.string().trim().min(2).max(60),
  intent: z.string().trim().max(2000).optional().or(z.literal("")),
  idempotencyKey: z.string().min(6).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const parsed = runSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "workflowKey is required.");

  const wf = await prisma.workflowDefinition.findFirst({
    where: { workspaceId: auth.ctx.workspaceId, key: parsed.data.workflowKey, enabled: true },
  });
  if (!wf) return fail(404, "not_found", "Workflow not found or disabled.");

  if (parsed.data.idempotencyKey) {
    const existing = await prisma.workflowExecution.findFirst({
      where: { workspaceId: auth.ctx.workspaceId, input: { contains: parsed.data.idempotencyKey } },
    });
    if (existing) return ok({ executionId: existing.id, reused: true });
  }

  const steps = (JSON.parse(wf.definition) as { steps: unknown[] }).steps;
  const exec = await prisma.workflowExecution.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      workflowId: wf.id,
      trigger: "manual",
      status: "queued",
      input: JSON.stringify({
        workflowKey: wf.key,
        steps,
        intent: parsed.data.intent ?? "",
        idempotencyKey: parsed.data.idempotencyKey ?? null,
      }),
    },
  });
  await audit(auth.ctx, "workflow.start", "workflow_execution", exec.id, { workflowKey: wf.key });

  // enqueue the first step(s) right away
  const { advanceWorkflow } = await import("@/server/agents/director");
  await advanceWorkflow(exec.id);
  const { drainQueueInline } = await import("@/server/agents/dispatch");
  const run = await drainQueueInline(auth.ctx.workspaceId, undefined, 8_000);
  const after = await prisma.workflowExecution.findUnique({ where: { id: exec.id }, select: { status: true } });
  return ok({ executionId: exec.id, status: after?.status, drainedTo: run.status }, { status: 202 });
}
