/**
 * Task dispatch helpers: create tasks and inline-drain the queue (dev path)
 * with a bounded wait. Idempotent creates; verified states by the director.
 */
import { prisma } from "@/lib/db";
import { createTask as createTaskBase } from "@/server/agents/director";
import { TASK_TYPES, type TaskType } from "@/server/agents/types";
import { runTaskByIdBlocked } from "@/server/queue/runner";

export const TASK_TYPES_ALIAS = TASK_TYPES;

export { createTaskBase as createTask };

/** Runs the queue inline for the caller's wait budget (bounded, dev-friendly). */
export async function drainQueueInline(workspaceId: string, taskId?: string, budgetMs = 20_000): Promise<{ status: string | null }> {
  void taskId;
  const start = Date.now();
  while (Date.now() - start < budgetMs) {
    await runTaskByIdBlocked(workspaceId, 1);
    if (taskId) {
      const t = await prisma.agentTask.findUnique({ where: { id: taskId }, select: { status: true } });
      if (t && ["succeeded", "failed", "waiting_for_approval", "cancelled"].includes(t.status)) {
        return { status: t.status };
      }
    }
    const more = await prisma.agentTask.findFirst({ where: { workspaceId, status: "queued" }, select: { id: true } });
    if (!more) break;
  }
  if (taskId) {
    const t = await prisma.agentTask.findUnique({ where: { id: taskId }, select: { status: true } });
    return { status: t?.status ?? null };
  }
  return { status: null };
}
