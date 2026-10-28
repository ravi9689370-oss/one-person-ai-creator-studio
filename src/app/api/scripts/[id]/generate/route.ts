/**
 * Script approval submission + AI generation request (routed through the
 * Studio Director task system so every AI action is tracked and auditable).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody } from "@/server/api";
import { createApprovalRequest } from "@/server/approvals";
import { createTask, drainQueueInline } from "@/server/agents/dispatch";

const submitSchema = z.object({ scriptId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, submitSchema);
  if ("status" in body) return body as Response;

  const script = await prisma.script.findFirst({ where: { id: body.data.scriptId, workspaceId: auth.ctx.workspaceId } });
  if (!script) return fail(404, "not_found", "Script not found.");
  if (script.status === "pending_approval") return fail(409, "already_pending", "This script is already awaiting approval.");

  const version = await prisma.scriptVersion.findFirst({
    where: { scriptId: script.id, version: script.currentVersion },
  });
  if (!version || version.body.trim().length === 0) return fail(422, "empty_version", "The current version has no content to review.");

  const approval = await createApprovalRequest(
    auth.ctx.workspaceId,
    {
      objectType: "script",
      objectId: script.id,
      title: `Script for approval: ${script.title}`,
      context: { scriptId: script.id, versionId: version.id, requestedBy: auth.ctx.userId },
    },
    auth.ctx
  );
  await prisma.script.update({ where: { id: script.id }, data: { status: "pending_approval" } });
  return ok({ approvalId: approval.id }, { status: 201 });
}

const generateSchema = z.object({
  scriptId: z.string().min(1),
  direction: z.string().trim().max(400).optional(),
});

/** Creates an AI revision task for an existing script (agent: script). */
export async function PUT(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, generateSchema);
  if ("status" in body) return body as Response;

  const script = await prisma.script.findFirst({ where: { id: body.data.scriptId, workspaceId: auth.ctx.workspaceId } });
  if (!script) return fail(404, "not_found", "Script not found.");

  const { id: taskId } = await createTask({
    workspaceId: auth.ctx.workspaceId,
    type: "script.revise",
    input: { message: body.data.direction ?? script.hook ?? script.title, scriptId: script.id },
    actorId: auth.ctx.userId,
    subject: `Revise script ${script.title}`,
  });
  const run = await drainQueueInline(auth.ctx.workspaceId, taskId);
  return ok({ taskId: id(taskId), runStatus: run }, { status: 202 });
}

function id(v: string): string {
  return v;
}
