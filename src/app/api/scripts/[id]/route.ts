import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody } from "@/server/api";

type P = { params: { id: string } };

export async function GET(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const script = await prisma.script.findFirst({
    where: { id: params.id, workspaceId: auth.ctx.workspaceId },
    include: {
      versions: { orderBy: { version: "desc" }, select: { id: true, version: true, body: true, tone: true, targetMin: true, createdAt: true, createdById: true } },
      topic: { select: { id: true, title: true } },
    },
  });
  if (!script) return fail(404, "not_found", "Script not found.");
  return ok({ script });
}

const patchSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  format: z.enum(["long_form", "short_form", "outline", "sponsor_read"]).optional(),
  platform: z.string().trim().min(2).max(40).optional(),
  language: z.string().trim().min(2).max(8).optional(),
  hook: z.string().trim().max(300).optional(),
  sponsorName: z.string().trim().max(120).optional(),
  sponsorTerms: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "pending_approval", "approved", "rejected", "needs_revision", "archived"]).optional(),
  newVersion: z
    .object({
      body: z.string().trim().min(1).max(40_000),
      tone: z.string().trim().max(120).optional(),
      targetMin: z.number().int().min(1).max(90).optional(),
      changeNote: z.string().trim().max(500).optional(),
    })
    .optional(),
});

export async function PATCH(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const existing = await prisma.script.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Script not found.");

  const body = await readBody(req, patchSchema);
  if ("status" in body) return body as Response;
  const { newVersion, ...updates } = body.data;
  const data: Record<string, unknown> = { ...updates };

  if (newVersion) {
    const maxV = await prisma.scriptVersion.aggregate({ where: { scriptId: existing.id }, _max: { version: true } });
    const nextVersion = (maxV._max.version ?? 0) + 1;
    await prisma.scriptVersion.create({
      data: {
        scriptId: existing.id,
        version: nextVersion,
        body: newVersion.body,
        tone: newVersion.tone ?? null,
        targetMin: newVersion.targetMin ?? null,
        changeNote: newVersion.changeNote ?? null,
        createdById: auth.ctx.userId,
      },
    });
    data.currentVersion = nextVersion;
  }

  const script = await prisma.script.update({
    where: { id: existing.id },
    data: data as never,
  });
  return ok({ script: { id: script.id, currentVersion: script.currentVersion, status: script.status } });
}

const deleteHard = z.object({});

export async function DELETE(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void deleteHard;
  const existing = await prisma.script.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Script not found.");
  if (existing.status === "approved") {
    return fail(409, "delete_by_version", "Approved scripts are archived instead of deleted to preserve history. Set status to archived.");
  }
  await prisma.script.delete({ where: { id: existing.id } });
  return ok({ deleted: true });
}

void readBody;
