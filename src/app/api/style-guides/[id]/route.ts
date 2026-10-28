import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail } from "@/server/api";

type P = { params: { id: string } };

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  platform: z.string().trim().max(40).optional(),
  rules: z.string().trim().min(1).max(20_000).optional(),
});

export async function PATCH(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const existing = await prisma.styleGuide.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Style guide not found.");
  const raw = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid fields.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  const guide = await prisma.styleGuide.update({ where: { id: existing.id }, data: parsed.data });
  return ok({ guide });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const existing = await prisma.styleGuide.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Style guide not found.");
  await prisma.styleGuide.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
}

void z;
