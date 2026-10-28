/** Workspace metrics snapshot derivation (Analytics Agent service). */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, ok } from "@/server/api";

const DAY = 24 * 3600 * 1000;

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const ws = auth.ctx.workspaceId;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since7 = new Date(now.getTime() - 7 * DAY);

  const [revenue30, revenuePrev30, postsByPlatform, leadsByStage, clipsReady, voiceJobsOk, personasTop] = await Promise.all([
    prisma.revenueRecord.aggregate({ where: { workspaceId: ws, kind: "sale", occurredAt: { gte: since30 } }, _sum: { amountCents: true }, _count: true }),
    prisma.revenueRecord.aggregate({ where: { workspaceId: ws, kind: "sale", occurredAt: { gte: new Date(now.getTime() - 60 * DAY), lt: since30 } }, _sum: { amountCents: true }, _count: true }),
    prisma.publishedPost.groupBy({ by: ["platform"], where: { workspaceId: ws, status: "published" }, _count: true }),
    prisma.lead.groupBy({ by: ["stage"], where: { workspaceId: ws }, _count: true }),
    prisma.generatedClip.count({ where: { job: { workspaceId: ws }, status: { in: ["ready", "verified"] } } }),
    prisma.voiceJob.count({ where: { workspaceId: ws, status: "succeeded" } }),
    prisma.localizationVariant.findMany({ where: { project: { workspaceId: ws } }, select: { language: true, status: true } }),
  ]);

  const languageCounts = personasTop.reduce<Record<string, number>>((acc, v) => {
    acc[v.language] = (acc[v.language] ?? 0) + 1;
    return acc;
  }, {});

  const metrics = {
    revenue30dCents: revenue30._sum.amountCents ?? 0,
    revenue30dDeltaPct:
      (revenuePrev30._sum.amountCents ?? 0) > 0
        ? Math.round((((revenue30._sum.amountCents ?? 0) - (revenuePrev30._sum.amountCents as number)) / (revenuePrev30._sum.amountCents as number)) * 100)
        : null,
    salesCount30d: revenue30._count,
    leadsByStage: Object.fromEntries(leadsByStage.map((g) => [g.stage, g._count])),
    publishedByPlatform: Object.fromEntries(postsByPlatform.map((g) => [g.platform, g._count])),
    languageVariants: languageCounts,
    clipsReady,
    voiceJobsSucceeded: voiceJobsOk,
  };

  await prisma.analyticsSnapshot.create({
    data: {
      workspaceId: ws,
      scope: "revenue",
      channel: "all",
      metrics: JSON.stringify(metrics),
      source: "derived",
      periodStart: since7,
      periodEnd: now,
    },
  });

  return ok({ metrics, sourced: "derived: revenue_records, leads, published_posts, localization_variants" });
}
