import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";

/** Experiment updates: record REAL captured data with an explicit source. */
export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const schema = z.object({
    experimentId: z.string().min(1),
    action: z.enum(["record", "stop", "conclude"]),
    variant: z.enum(["a", "b"]).optional(),
    impressions: z.number().int().min(0).max(100_000_000).optional(),
    clicks: z.number().int().min(0).max(100_000_000).optional(),
    source: z.enum(["manual", "provider_api"]).default("manual"),
  });
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid payload.");
  const exp = await prisma.thumbnailExperiment.findFirst({ where: { id: parsed.data.experimentId, workspaceId: auth.ctx.workspaceId } });
  if (!exp) return fail(404, "not_found", "Experiment not found.");

  const results = (exp.results ? JSON.parse(exp.results) : { a: { impressions: 0 }, b: { impressions: 0 }, note: "" }) as {
    a: { impressions: number; clicks: number; source?: string };
    b: { impressions: number; clicks: number; source?: string };
    note: string;
  };

  if (parsed.data.action === "record") {
    if (!parsed.data.variant || parsed.data.impressions === undefined) return fail(422, "variant_impressions_required", "variant and impressions are required.");
    const target = parsed.data.variant === "a" ? results.a : results.b;
    target.impressions += parsed.data.impressions;
    target.clicks = (target.clicks ?? 0) + (parsed.data.clicks ?? 0);
    target.source = parsed.data.source;
    results.note = results.note || "Real recorded metrics only - no significance claimed until adequate data exists.";
  } else if (parsed.data.action === "stop") {
    await prisma.thumbnailExperiment.update({ where: { id: exp.id }, data: { status: "stopped", endedAt: new Date() } });
    return ok({ status: "stopped" });
  } else {
    const hasData = results.a.impressions > 0 && results.b.impressions > 0;
    if (!hasData) return fail(409, "insufficient_data", "An experiment can only conclude with recorded data for both variants.");
    await prisma.thumbnailExperiment.update({ where: { id: exp.id }, data: { status: "completed", endedAt: new Date(), results: JSON.stringify(results) } });
    return ok({ status: "completed", winnerCaveat: "Results are descriptive, not statistically verified unless you record a significance analysis separately." });
  }

  await prisma.thumbnailExperiment.update({ where: { id: exp.id }, data: { results: JSON.stringify(results) } });
  await audit(auth.ctx, "thumbnail.experiment.record", "thumbnail_experiment", exp.id, { variant: parsed.data.variant });
  return ok({ ok: true });
}
