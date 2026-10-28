import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";

type P = { params: { id: string } };

const patchSchema = z.object({
  stage: z.enum(["new", "contacted", "meeting", "proposal", "won", "lost"]).optional(),
  qualification: z.enum(["new", "qualified", "unqualified", "high_value"]).optional(),
  estimatedValueCents: z.number().int().min(0).optional(),
  notes: z.string().trim().max(4000).optional(),
  intent: z.string().trim().max(40).optional(),
});

export async function PATCH(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const lead = await prisma.lead.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!lead) return fail(404, "not_found", "Lead not found.");
  const raw = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid fields.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });

  const updated = await prisma.lead.update({ where: { id: lead.id }, data: parsed.data });
  if (parsed.data.stage) {
    await prisma.crmActivity.create({
      data: { workspaceId: auth.ctx.workspaceId, leadId: lead.id, type: "stage_change", content: `Stage moved to ${parsed.data.stage}`, createdById: auth.ctx.userId },
    });
  }
  if (lead.qualification === "new" && parsed.data.qualification === "high_value") {
    const { notify } = await import("@/server/notifications");
    await notify.publish(auth.ctx.workspaceId, {
      type: "lead",
      title: "High-value lead flagged",
      body: `${lead.name} is now high_value - human attention recommended.`,
      link: `/crm/leads/${lead.id}`,
    });
  }
  await audit(auth.ctx, "lead.update", "lead", lead.id, parsed.data);
  return ok({ lead: updated });
}
