import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";

const decisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  note: z.string().trim().max(1000).optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const request = await prisma.approvalRequest.findFirst({
    where: { id: params.id, workspaceId: auth.ctx.workspaceId },
  });
  if (!request) return fail(404, "not_found", "Approval request not found.");
  return ok({ request });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const parsed = decisionSchema.safeParse(raw);
  if (!parsed.success) return fail(422, "validation_failed", "decision must be approved | rejected | changes_requested.");
  try {
    const { decideApproval } = await import("@/server/approvals");
    await decideApproval(params.id, parsed.data.decision, auth.ctx.userId, parsed.data.note);
    await audit(auth.ctx, `approval.${parsed.data.decision}`, "approval_request", params.id, { note: parsed.data.note ?? null });
    return ok({ status: parsed.data.decision });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Decision failed.";
    return fail(400, "decision_failed", msg);
  }
}
