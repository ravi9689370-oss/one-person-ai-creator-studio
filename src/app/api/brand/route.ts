import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody, audit } from "@/server/api";
import { clearBrandCached } from "@/lib/brand-cache";

const patchSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  tagline: z.string().trim().max(200).optional().or(z.literal("")),
  voice: z.string().trim().max(6000).optional().or(z.literal("")),
  tone: z.string().trim().max(120).optional(),
  mission: z.string().trim().max(2000).optional().or(z.literal("")),
  audience: z.string().trim().max(2000).optional().or(z.literal("")),
  guidelines: z.string().trim().max(8000).optional().or(z.literal("")),
  timezone: z.string().trim().max(60).optional(),
  personas: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(2000).optional().or(z.literal("")),
        painPoints: z.string().trim().max(2000).optional().or(z.literal("")),
        goals: z.string().trim().max(2000).optional().or(z.literal("")),
      })
    )
    .max(10)
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, patchSchema);
  if ("status" in body) return body as Response;
  const brand = await prisma.brandProfile.findUnique({ where: { workspaceId: auth.ctx.workspaceId } });
  if (!brand) return fail(404, "not_found", "Brand profile missing.");

  const { personas, timezone, ...updates } = body.data;
  await prisma.brandProfile.update({
    where: { id: brand.id },
    data: {
      displayName: updates.displayName ?? brand.displayName,
      tagline: updates.tagline !== undefined ? updates.tagline : brand.tagline,
      voice: updates.voice !== undefined ? updates.voice : brand.voice,
      tone: updates.tone ?? brand.tone,
      mission: updates.mission !== undefined ? updates.mission : brand.mission,
      audience: updates.audience !== undefined ? updates.audience : brand.audience,
      guidelines: updates.guidelines !== undefined ? updates.guidelines : brand.guidelines,
    },
  });
  if (timezone) {
    await prisma.workspace.update({ where: { id: auth.ctx.workspaceId }, data: { timezone } });
  }
  if (personas) {
    await prisma.audiencePersona.deleteMany({ where: { brandProfileId: brand.id } });
    for (const p of personas) {
      await prisma.audiencePersona.create({
        data: {
          brandProfileId: brand.id,
          name: p.name,
          description: p.description || null,
          painPoints: p.painPoints || null,
          goals: p.goals || null,
        },
      });
    }
  }
  clearBrandCached(auth.ctx.workspaceId);
  await audit(auth.ctx, "brand.update", "brand_profile", brand.id, undefined);
  return ok({ ok: true });
}

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const brand = await prisma.brandProfile.findUnique({
    where: { workspaceId: auth.ctx.workspaceId },
    include: { personas: true },
  });
  return ok({ brand });
}
