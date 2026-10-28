/**
 * Scheduler process: checks every minute which scheduled reports are due in
 * their own timezone (DST-safe), generates them, and marks them run. External
 * schedulers (GitHub Actions cron, Vercel cron) can call
 * POST /api/cron/morning-brief with x-cron-secret instead of running this.
 */
import cron from "node-cron";
import { prisma } from "@/lib/db";
import { isDueNow } from "@/lib/time";

async function tick(): Promise<void> {
  const schedules = await prisma.scheduledReport.findMany({
    where: { kind: "morning_brief", enabled: true },
  });
  for (const s of schedules) {
    if (!isDueNow({ timezone: s.timezone, hourLocal: s.hourLocal, minuteLocal: s.minuteLocal, lastRunForDate: s.lastRunForDate })) continue;
    console.log(`[scheduler] morning brief due for workspace ${s.workspaceId} (${s.timezone})`);
    try {
      const { generateMorningBrief } = await import("@/server/agents/brief");
      const result = await generateMorningBrief(s.workspaceId);
      console.log(`[scheduler] brief ${result.forDate} -> report ${result.reportId}`);
    } catch (e) {
      console.error("[scheduler] brief generation failed:", e);
    }
  }
}

// drain agent queue opportunistically so a single long-lived process can serve dev
async function queueTick(): Promise<void> {
  const pending = await prisma.agentTask.findFirst({ where: { status: "queued" }, select: { workspaceId: true } });
  if (pending) {
    const { runTaskByIdBlocked } = await import("@/server/queue/runner");
    await runTaskByIdBlocked(pending.workspaceId, 5);
  }
}

async function main(): Promise<void> {
  console.log("[scheduler] starting - scheduled reports checked every minute");
  await tick(); // immediate catch-up on boot
  await queueTick();
  cron.schedule("* * * * *", () => {
    void tick().catch((e) => console.error("[scheduler] tick failed:", e));
  });
  cron.schedule("*/2 * * * *", () => {
    void queueTick().catch((e) => console.error("[scheduler] queue tick failed:", e));
  });
}

void main();
