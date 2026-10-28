import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail } from "@/server/api";

type P = { params: { id: string } };

const patchSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  channel: z.string().trim().max(40).optional(),
  scheduledFor: z.string().datetime({ offset: true }).optional().nullable(),
  status: z.enum(["planned", "in_production", "ready", "published", "cancelled"]).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const existing = await prisma.calendarItem.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Calendar item not found.");
  const raw = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid fields.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  const item = await prisma.calendarItem.update({ where: { id: existing.id }, data: parsed.data });
  return ok({ item });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const existing = await prisma.calendarItem.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Calendar item not found.");
  await prisma.calendarItem.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
}
