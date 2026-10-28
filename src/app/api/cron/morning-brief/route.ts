/** Executive cron entrypoint for external schedulers (GitHub Actions, etc.). */
import { NextRequest } from "next/server";
import { getCronSecret } from "@/lib/env";
import { prisma } from "@/lib/db";
import { isDueNow } from "@/lib/time";

export async function POST(req: NextRequest) {
  const secret = getCronSecret();
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return Response.json({ error: { code: "unauthorized", message: "Invalid cron secret." } }, { status: 401 });
  }
  const schedules = await prisma.scheduledReport.findMany({ where: { kind: "morning_brief", enabled: true } });
  const results: { workspaceId: string; forDate?: string; skipped?: string }[] = [];
  for (const s of schedules) {
    const due = isDueNow({
      timezone: s.timezone,
      hourLocal: s.hourLocal,
      minuteLocal: s.minuteLocal,
      lastRunForDate: s.lastRunForDate,
    });
    if (!due) {
      results.push({ workspaceId: s.workspaceId, skipped: "not_due_yet" });
      continue;
    }
    const { generateMorningBrief } = await import("@/server/agents/brief");
    const r = await generateMorningBrief(s.workspaceId);
    results.push({ workspaceId: s.workspaceId, forDate: r.forDate });
  }
  return Response.json({ ok: true, results });
}
