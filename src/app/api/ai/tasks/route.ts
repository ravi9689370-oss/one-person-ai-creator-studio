/**
 * AI task intake for the Studio Director. Creates an AgentTask and (in dev /
 * when no external worker is running) drains the queue inline so the UI shows
 * real pipeline results. Idempotency keys prevent duplicate paid jobs.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, ok, fail, readBody } from "@/server/api";
import { createTask, TASK_TYPES_ALIAS } from "@/server/agents/dispatch";
import { drainQueueInline } from "@/server/agents/dispatch";

const intakeSchema = z.object({
  intent: z.string().trim().min(3).max(2000),
  type: z.enum([...TASK_TYPES_ALIAS] as [string, ...string[]]).optional(),
  waitForResult: z.boolean().default(true),
  idempotencyKey: z.string().min(6).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, intakeSchema);
  if ("status" in body) return body as Response;

  const { createTask } = await import("@/server/agents/dispatch");
  const { classifyIntent } = await import("@/server/agents/director");
  let type = body.data.type;
  if (!type) type = classifyIntent(body.data.intent).type;

  const { id: taskId } = await createTask({
    workspaceId: auth.ctx.workspaceId,
    type: type as never,
    input: { message: body.data.intent },
    actorId: auth.ctx.userId,
    idempotencyKey: body.data.idempotencyKey,
    subject: body.data.intent.slice(0, 120),
  });

  let runStatus: string | null = null;
  if (body.data.waitForResult) {
    const drained = await drainQueueInline(auth.ctx.workspaceId, taskId, 0);
    runStatus = drained.status;
  }
  return ok({ taskId, runStatus }, { status: 202 });
}

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void auth;
  void readBody;
  return ok({ types: TASK_TYPES_ALIAS });
}
