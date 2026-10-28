/** Maya conversation actions: tie a visitor identity, close, handoff. */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";

type P = { params: { id: string } };

const schema = z.object({
  action: z.enum(["escalate", "close", "attach_lead"]),
  reason: z.string().trim().max(500).optional(),
  leadId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const conversation = await prisma.conversation.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!conversation) return fail(404, "not_found", "Conversation not found.");
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid action.");

  if (parsed.data.action === "escalate") {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { isEscalated: true, status: "escalated", escalationReason: parsed.data.reason ?? "Creator initiated handoff", handoffAt: new Date() },
    });
    const { notify } = await import("@/server/notifications");
    await notify.publish(auth.ctx.workspaceId, { type: "lead", title: "Conversation escalated", body: parsed.data.reason ?? "Handoff requested", link: `/ai-maya/conversations/${conversation.id}` });
  } else if (parsed.data.action === "close") {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "closed" } });
  } else {
    if (!parsed.data.leadId) return fail(422, "lead_required", "leadId required.");
    const lead = await prisma.lead.findFirst({ where: { id: parsed.data.leadId, workspaceId: auth.ctx.workspaceId } });
    if (!lead) return fail(404, "not_found", "Lead not found.");
    await prisma.lead.update({ where: { id: lead.id }, data: { mayaConversationId: conversation.id } });
  }
  await audit(auth.ctx, `maya.${parsed.data.action}`, "conversation", conversation.id);
  return ok({ ok: true });
}
