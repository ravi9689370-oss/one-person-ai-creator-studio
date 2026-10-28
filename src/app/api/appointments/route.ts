import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail } from "@/server/api";

/** Appointment scheduling for the CRM (Cal.com adapter pending credentials). */
export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const schema = z.object({
    leadId: z.string().optional().or(z.literal("")),
    title: z.string().trim().min(2).max(160),
    startsAt: z.string().datetime({ offset: true }),
    durationMin: z.number().int().min(5).max(480).default(30),
    provider: z.enum(["cal", "manual", "maya"]).default("manual"),
    location: z.string().trim().max(200).optional().or(z.literal("")),
  });
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid payload.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  if (parsed.data.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: parsed.data.leadId, workspaceId: auth.ctx.workspaceId } });
    if (!lead) return fail(400, "invalid_lead", "Lead not found.");
  }
  const appt = await prisma.appointment.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      leadId: parsed.data.leadId || null,
      title: parsed.data.title,
      startsAt: new Date(parsed.data.startsAt),
      durationMin: parsed.data.durationMin,
      provider: parsed.data.provider,
      location: parsed.data.location || null,
    },
  });
  return ok({ id: appt.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const items = await prisma.appointment.findMany({
    where: { workspaceId: auth.ctx.workspaceId },
    orderBy: { startsAt: "asc" },
    take: 200,
  });
  return ok({ items });
}
