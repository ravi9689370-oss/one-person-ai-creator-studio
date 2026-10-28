import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail } from "@/server/api";

type P = { params: { id: string } };

const patchSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  content: z.string().trim().max(60_000).optional(),
  kind: z.enum(["reference", "voice_note", "product", "faq"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const existing = await prisma.knowledgeDocument.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Document not found.");
  const raw = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid fields.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  const updateData = { ...parsed.data, updatedAt: new Date() } as Record<string, unknown>;
  const doc = await prisma.knowledgeDocument.update({ where: { id: existing.id }, data: updateData as never });
  if (parsed.data.content !== undefined) {
    await prisma.knowledgeChunk.deleteMany({ where: { documentId: existing.id } });
    const chunks: string[] = [];
    for (let i = 0; i < parsed.data.content.length; i += 1200) {
      chunks.push(parsed.data.content.slice(i, i + 1200));
    }
    if (chunks.length === 0) chunks.push("");
    await prisma.knowledgeChunk.createMany({ data: chunks.map((c, i) => ({ documentId: existing.id, position: i, content: c })) });
  }
  return ok({ doc });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const existing = await prisma.knowledgeDocument.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Document not found.");
  await prisma.knowledgeDocument.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
}
