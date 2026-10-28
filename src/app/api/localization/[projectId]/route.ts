/**
 * Variant actions: translate (agent), approve after review, request dubbing,
 * and per-variant quality review notes.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";

type P = { params: { projectId: string } };

const actionSchema = z.object({
  action: z.enum(["translate", "approve", "dub", "reject"]),
  language: z.string().trim().min(2).max(8),
  text: z.string().trim().max(20_000).optional(),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const project = await prisma.localizationProject.findFirst({ where: { id: params.projectId, workspaceId: auth.ctx.workspaceId } });
  if (!project) return fail(404, "not_found", "Localization project not found.");

  const raw = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid action.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  const { action, language } = parsed.data;

  const variant = await prisma.localizationVariant.findUnique({
    where: { projectId_language: { projectId: project.id, language } },
  });

  if (action === "translate") {
    if (variant && ["in_review", "approved", "dubbed"].includes(variant.status)) {
      return fail(409, "already_running", `Variant for ${language} is already ${variant.status}.`);
    }
    const { createTask, drainQueueInline } = await import("@/server/agents/dispatch");
    const { id: taskId } = await createTask({
      workspaceId: auth.ctx.workspaceId,
      type: "localize.translate",
      input: { message: `translate to ${language}`, projectId: project.id, language, text: parsed.data.text },
      actorId: auth.ctx.userId,
    });
    const run = await drainQueueInline(auth.ctx.workspaceId, taskId, 25_000);
    return ok({ taskId, status: run.status }, { status: 202 });
  }

  if (!variant) return fail(404, "variant_missing", `No variant for ${language} yet.`);

  if (action === "approve") {
    if (variant.status !== "in_review") return fail(409, "not_reviewable", `Variant status is '${variant.status}', not in_review.`);
    if (!parsed.data.note) return fail(422, "note_required", "Human translation reviews must include the reviewer's note.");
    const { createApprovalRequest, decideApproval } = await import("@/server/approvals");
    const approval = await createApprovalRequest(auth.ctx.workspaceId, {
      objectType: "localization",
      objectId: variant.id,
      title: `Review ${language} translation (${project.name})`,
      context: { variantId: variant.id, note: parsed.data.note },
    }, auth.ctx);
    await decideApproval(approval.id, "approved", auth.ctx.userId, parsed.data.note);
    await audit(auth.ctx, "localization.approve", "localization_variant", variant.id, { language });
    return ok({ status: "approved" });
  }

  if (action === "reject") {
    if (variant.status !== "in_review") return fail(409, "not_reviewable", `Variant status is '${variant.status}'.`);
    const { decideOrCreateRejection } = await import("@/server/variant-review");
    await decideOrCreateRejection(auth.ctx.workspaceId, variant.id, auth.ctx.userId, parsed.data.note ?? "Rejected at review");
    return ok({ status: "queued" });
  }

  // dub
  if (variant.status !== "approved") {
    return fail(409, "not_approved", `Translation must be approved before dubbing (status: ${variant.status}).`);
  }
  const { createTask, drainQueueInline } = await import("@/server/agents/dispatch");
  const { id: taskId } = await createTask({
    workspaceId: auth.ctx.workspaceId,
    type: "localize.dub",
    input: { message: `dub to ${language}`, projectId: project.id, language },
    actorId: auth.ctx.userId,
  });
  const run = await drainQueueInline(auth.ctx.workspaceId, taskId, 30_000);
  return ok({ taskId, status: run.status }, { status: 202 });
}
