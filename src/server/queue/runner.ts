/**
 * Durable queue runner: drains agent_task rows whose status is `queued`.
 * Invoked by `npm run worker` (long-lived) and inline after API task creation
 * (so the dev UI exercises the real pipeline without a separate process).
 */
import { prisma } from "@/lib/db";
import { runTaskById } from "@/server/agents/handlers";

export async function drainQueue(workspaceId?: string, limit = 25): Promise<number> {
  let drained = 0;
  for (let i = 0; i < limit; i++) {
    const task = await prisma.agentTask.findFirst({
      where: {
        status: "queued",
        ...(workspaceId ? { workspaceId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    if (!task) break;
    // claim
    const claimed = await prisma.agentTask.updateMany({
      where: { id: task.id, status: "queued" },
      data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    try {
      await runTaskById(task.id);
      drained++;
    } catch (e) {
      const attempts = task.attempts + 1;
      await prisma.agentTask.update({
        where: { id: task.id },
        data: {
          status: attempts >= task.maxAttempts ? "failed" : "queued",
          error: `Runner error: ${e instanceof Error ? e.message : "unknown"}`,
          attempts,
        },
      });
      drained++;
    }
  }
  return drained;
}

/** Bounded blocking run used by inline dispatch (API request context). */
export async function runTaskByIdBlocked(workspaceId: string, limit = 1): Promise<number> {
  let n = 0;
  for (let i = 0; i < limit; i++) {
    const task = await prisma.agentTask.findFirst({
      where: { status: "queued", workspaceId },
      orderBy: { createdAt: "asc" },
    });
    if (!task) break;
    const claimed = await prisma.agentTask.updateMany({
      where: { id: task.id, status: "queued" },
      data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;
    try {
      await runTaskById(task.id);
      n++;
    } catch (e) {
      const attempts = task.attempts + 1;
      await prisma.agentTask.update({
        where: { id: task.id },
        data: {
          status: attempts >= task.maxAttempts ? "failed" : "queued",
          error: `Runner error: ${e instanceof Error ? e.message : "unknown"}`,
          attempts,
        },
      });
      n++;
    }
  }
  return n;
}

