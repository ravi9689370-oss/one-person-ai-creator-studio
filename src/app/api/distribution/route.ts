/**
 * Distribution engine APIs: platform account status, scheduled posts with the
 * approval gate, publish attempts (fail-closed without a connected platform),
 * and manual performance ingestion.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody, audit } from "@/server/api";
import { refreshIntegrationStatuses } from "@/server/integrations";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const [accounts, campaigns, counts] = await Promise.all([
    prisma.socialAccount.findMany({ where: { workspaceId: auth.ctx.workspaceId } }),
    prisma.distributionCampaign.findMany({ where: { workspaceId: auth.ctx.workspaceId }, orderBy: { updatedAt: "desc" } }),
    prisma.$transaction([
      prisma.scheduledPost.count({ where: { workspaceId: auth.ctx.workspaceId, status: { in: ["approved", "queued"] } } }),
      prisma.publishedPost.count({ where: { workspaceId: auth.ctx.workspaceId } }),
      prisma.scheduledPost.count({ where: { workspaceId: auth.ctx.workspaceId, status: "failed" } }),
    ]),
  ]);
  return ok({ accounts, campaigns, counts: { queued: counts[0], published: counts[1], failed: counts[2] } });
}

const postSchema = z.object({
  platform: z.enum(["youtube", "tiktok", "instagram", "facebook", "linkedin", "substack", "spotify"]),
  title: z.string().trim().min(2).max(200),
  caption: z.string().trim().max(4000).optional().or(z.literal("")),
  hashtags: z.string().trim().max(600).optional().or(z.literal("")),
  assetIds: z.array(z.string()).max(10).default([]),
  scheduledFor: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  campaignId: z.string().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, postSchema);
  if ("status" in body) return body as Response;
  for (const aid of body.data.assetIds) {
    const a = await prisma.mediaAsset.findFirst({ where: { id: aid, workspaceId: auth.ctx.workspaceId } });
    if (!a) return fail(400, "invalid_asset", `Asset ${aid} not found.`);
  }
  const post = await prisma.scheduledPost.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      platform: body.data.platform,
      title: body.data.title,
      caption: body.data.caption || null,
      hashtags: body.data.hashtags || null,
      assetIds: JSON.stringify(body.data.assetIds),
      metadata: JSON.stringify({ aspect: "auto" }),
      scheduledFor: body.data.scheduledFor ? new Date(body.data.scheduledFor) : null,
      campaignId: body.data.campaignId || null,
      status: "draft",
      createdById: auth.ctx.userId,
    },
  });
  await audit(auth.ctx, "post.create", "scheduled_post", post.id, { platform: post.platform });
  return ok({ id: post.id }, { status: 201 });
}
