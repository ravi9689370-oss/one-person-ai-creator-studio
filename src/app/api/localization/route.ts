import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody, audit } from "@/server/api";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const projects = await prisma.localizationProject.findMany({
    where: { workspaceId: auth.ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { variants: { select: { id: true, language: true, status: true, subtitleAssetId: true, dubJobId: true } } },
  });
  return ok({ projects });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(140),
  sourceLanguage: z.string().trim().min(2).max(8).default("en"),
  sourceScriptId: z.string().optional().or(z.literal("")),
  sourceAssetId: z.string().optional().or(z.literal("")),
  playbackType: z.enum(["audio", "subtitles", "lipsync"]).default("audio"),
  languages: z.array(z.string().trim().min(2).max(8)).min(1).max(12).default(["es"]),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;

  if (body.data.sourceScriptId) {
    const s = await prisma.script.findFirst({ where: { id: body.data.sourceScriptId, workspaceId: auth.ctx.workspaceId } });
    if (!s) return fail(400, "invalid_script", "Source script not found.");
  }
  if (body.data.sourceAssetId) {
    const a = await prisma.mediaAsset.findFirst({ where: { id: body.data.sourceAssetId, workspaceId: auth.ctx.workspaceId } });
    if (!a) return fail(400, "invalid_asset", "Source asset not found.");
  }

  const project = await prisma.localizationProject.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      name: body.data.name,
      sourceLanguage: body.data.sourceLanguage,
      sourceScriptId: body.data.sourceScriptId || null,
      sourceAssetId: body.data.sourceAssetId || null,
      playbackType: body.data.playbackType,
      status: "active",
      variants: {
        create: body.data.languages.map((l) => ({ language: l, status: "queued", lipSyncAvailable: body.data.playbackType === "lipsync" })),
      },
    },
  });
  await audit(auth.ctx, "localization.create", "localization_project", project.id, { languages: body.data.languages });
  return ok({ id: project.id }, { status: 201 });
}
