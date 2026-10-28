import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody, audit } from "@/server/api";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const { searchParams } = req.nextUrl;
  const stage = searchParams.get("stage");
  const qualification = searchParams.get("qualification");
  const leads = await prisma.lead.findMany({
    where: {
      workspaceId: auth.ctx.workspaceId,
      ...(stage && stage !== "all" ? { stage } : {}),
      ...(qualification && qualification !== "all" ? { qualification } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id: true, name: true, email: true, source: true, intent: true, qualification: true, stage: true,
      estimatedValueCents: true, updatedAt: true, createdAt: true, mayaConversationId: true,
    },
  });
  return ok({ leads });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().optional().or(z.literal("")),
  source: z.enum(["maya", "manual", "referral", "social"]).default("manual"),
  intent: z.string().trim().max(40).optional().or(z.literal("")),
  stage: z.enum(["new", "contacted", "meeting", "proposal", "won", "lost"]).default("new"),
  estimatedValueCents: z.number().int().min(0).max(100_000_000).optional(),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;
  let contactId: string | null = null;
  if (body.data.email) {
    const contact = await prisma.contact.create({
      data: { workspaceId: auth.ctx.workspaceId, name: body.data.name, email: body.data.email, type: "lead" },
    });
    contactId = contact.id;
  }
  const lead = await prisma.lead.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      contactId,
      name: body.data.name,
      email: body.data.email || null,
      source: body.data.source,
      intent: body.data.intent || null,
      stage: body.data.stage,
      estimatedValueCents: body.data.estimatedValueCents ?? null,
      notes: body.data.notes || null,
    },
  });
  await prisma.crmActivity.create({
    data: { workspaceId: auth.ctx.workspaceId, leadId: lead.id, type: "note", content: "Lead created", createdById: auth.ctx.userId },
  });
  await audit(auth.ctx, "lead.create", "lead", lead.id);
  return ok({ id: lead.id }, { status: 201 });
}
