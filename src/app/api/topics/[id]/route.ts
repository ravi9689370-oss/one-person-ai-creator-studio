import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail } from "@/server/api";

type P = { params: { id: string } };

const patchSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  status: z.enum(["idea", "researched", "scripted", "produced", "published", "archived"]).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  notes: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(60).optional(),
});

export async function PATCH(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const existing = await prisma.contentTopic.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Topic not found.");
  const raw = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid fields.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  const topic = await prisma.contentTopic.update({ where: { id: existing.id }, data: parsed.data });
  return ok({ topic });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const existing = await prisma.contentTopic.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Topic not found.");
  void req.json;
  await prisma.contentTopic.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
}
