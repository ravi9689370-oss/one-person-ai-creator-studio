/**
 * Worker process: drains the durable agent-task queue continuously.
 * Runs alongside the web app in dev, or as a separate service in production.
 */
import { prisma } from "@/lib/db";

async function main(): Promise<void> {
  console.log("[worker] starting - polling agent_task queue");
  for (;;) {
    const pending = await prisma.agentTask.findFirst({ where: { status: "queued" }, select: { workspaceId: true } });
    if (pending) {
      try {
        const { runTaskByIdBlocked } = await import("@/server/queue/runner");
        const n = await runTaskByIdBlocked(pending.workspaceId, 5);
        if (n === 0) await sleep(1500);
      } catch (e) {
        console.error("[worker] loop error:", e);
        await sleep(3000);
      }
    } else {
      await sleep(2000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
