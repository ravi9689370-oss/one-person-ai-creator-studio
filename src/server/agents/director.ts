import { prisma } from "@/lib/db";
import type { TaskType } from "./types";

/**
 * Central Studio Director: task intake, classification, agent selection,
 * dependency planning, and verification-aware status tracking.
 */

export function classifyIntent(message: string): { type: TaskType; confidence: "rule"; reason: string } {
  const m = message.toLowerCase();
  // Keyword-based routing (deterministic and auditable). LLM classification can
  // be layered on top later; rules keep the behavior testable offline.
  if (/(script|hook|opening|storyboard text|sponsor read)/.test(m)) return { type: "script.generate", confidence: "rule", reason: "script keywords" };
  if (/(voice|tts|speak|voiceover|narrat)/.test(m)) return { type: "voice.generate", confidence: "rule", reason: "voice keywords" };
  if (/(translate|dub|localiz|spanish|hindi|subtitl)/.test(m)) return { type: "localize.translate", confidence: "rule", reason: "localization keywords" };
  if (/(video|render|b-roll|visual)/.test(m)) return { type: "video.assemble", confidence: "rule", reason: "video keywords" };
  if (/(thumbnail|cover image|ctr image)/.test(m)) return { type: "thumbnail.concept", confidence: "rule", reason: "thumbnail keywords" };
  if (/(clip|short|repurpose|vertical)/.test(m)) return { type: "repurpose.generate_clips", confidence: "rule", reason: "repurpose keywords" };
  if (/(transcrib|srt|caption from audio)/.test(m)) return { type: "transcribe.audio", confidence: "rule", reason: "transcription keywords" };
  if (/(idea|ideate|strategy)/.test(m)) return { type: "strategy.ideate", confidence: "rule", reason: "ideation keywords" };
  if (/(report|brief|analytics|numbers)/.test(m)) return { type: "analytics.report", confidence: "rule", reason: "reporting keywords" };
  if (/(research|source|fact)/.test(m)) return { type: "research.brief", confidence: "rule", reason: "research keywords" };
  return { type: "research.brief", confidence: "rule", reason: "default intake -> research" };
}

export const TASK_AGENT: Record<string, string> = {
  "research.brief": "research",
  "strategy.ideate": "strategy",
  "script.generate": "script",
  "script.revise": "script",
  "voice.generate": "voice",
  "transcribe.audio": "localization",
  "localize.translate": "localization",
  "localize.dub": "localization",
  "video.assemble": "video",
  "video.render": "video",
  "thumbnail.concept": "thumbnail",
  "repurpose.generate_clips": "repurpose",
  "publish.prepare_package": "distribution",
  "analytics.report": "analytics",
  "quality.review": "quality",
  "maya.reply": "sales",
  "lead.qualify": "sales",
  "brief.morning": "analytics",
};

export async function createTask(input: {
  workspaceId: string;
  type: TaskType;
  input: Record<string, unknown>;
  actorId?: string | null;
  subject?: string;
  idempotencyKey?: string;
  workflowExecutionId?: string;
  outputType?: string; // workflow step key alias used as this task's type string
}): Promise<{ id: string }> {
  const type = input.outputType ?? input.type;
  const agentKey = TASK_AGENT[input.type] ?? "director";
  const task = await prisma.agentTask.create({
    data: {
      workspaceId: input.workspaceId,
      type,
      agentKey,
      status: "queued",
      inputRefs: JSON.stringify({ message: input.input, subject: input.subject ?? null }),
      idempotencyKey: input.idempotencyKey,
      workflowExecutionId: input.workflowExecutionId,
      maxAttempts: 3,
    },
  });
  await prisma.agent
    .update({ where: { workspaceId_key: { workspaceId: input.workspaceId, key: agentKey } }, data: { lastRunAt: new Date() } })
    .catch(() => undefined);
  return { id: task.id };
}

/**
 * Verify completed-task outputs exist before allowing `succeeded` status.
 * Ref values are URI-like: media:<assetId>, script:<scriptId>, task:<taskId>.
 */
export async function verifyOutputRefs(workspaceId: string, refs: Record<string, string>): Promise<{ ok: boolean; problem?: string }> {
  for (const [refKey, refValue] of Object.entries(refs)) {
    if (!refValue || typeof refValue !== "string") return { ok: false, problem: `ref ${refKey} empty` };
    if (/^media:/.test(refValue)) {
      const asset = await prisma.mediaAsset.findFirst({ where: { id: refValue.slice(6), workspaceId } });
      if (!asset || !asset.path) return { ok: false, problem: `ref ${refKey}: media asset missing` };
    }
    if (/^script:/.test(refValue)) {
      const s = await prisma.script.findFirst({ where: { id: refValue.slice(7), workspaceId } });
      if (!s) return { ok: false, problem: `ref ${refKey}: script missing` };
    }
    if (/^task:/.test(refValue)) {
      const t = await prisma.agentTask.findFirst({ where: { id: refValue.slice(5), workspaceId } });
      if (!t) return { ok: false, problem: `ref ${refKey}: task missing` };
    }
  }
  return { ok: true };
}

/** Finalize a task after verifying claimed outputs actually exist. */
export async function finalizeTask(
  taskId: string,
  result: {
    status: "succeeded" | "failed" | "waiting_for_approval";
    summary: string;
    error?: string;
    outputRefs?: Record<string, string>;
    isMock?: boolean;
  },
  workspaceId: string
): Promise<void> {
  if (result.status === "succeeded" && result.outputRefs) {
    const v = await verifyOutputRefs(workspaceId, result.outputRefs);
    if (!v.ok) {
      await prisma.agentTask.update({
        where: { id: taskId },
        data: {
          status: "failed",
          finishedAt: new Date(),
          error: `Output verification failed: ${v.problem}`,
          outputRefs: null,
        },
      });
      return;
    }
  }
  await prisma.agentTask.update({
    where: { id: taskId },
    data: {
      status: result.status,
      summary: result.summary,
      error: result.error ?? null,
      outputRefs: result.outputRefs ? JSON.stringify(result.outputRefs) : null,
      isMock: result.isMock ?? false,
      finishedAt: new Date(),
    },
  });

  const task = await prisma.agentTask.findUnique({ where: { id: taskId } });
  if (task?.workflowExecutionId && result.status !== "failed") {
    await advanceWorkflow(task.workflowExecutionId);
  } else if (task?.workflowExecutionId && result.status === "failed") {
    await prisma.workflowExecution.update({
      where: { id: task.workflowExecutionId },
      data: { status: "failed", error: `Step ${task.type} failed: ${result.error ?? "unknown"}`, finishedAt: new Date() },
    });
  }
}

/**
 * Advance a workflow execution: find the next step whose dependencies are
 * done and enqueue it, or close the execution.
 */
export async function advanceWorkflow(workflowExecutionId: string): Promise<void> {
  const exec = await prisma.workflowExecution.findUnique({ where: { id: workflowExecutionId } });
  if (!exec) return;
  const input = (exec.input ? safeJson(exec.input) : null) as { workflowKey?: string; steps?: { key: string; agentKey: string; approval?: boolean; needs?: string[] }[] } | null;

  // The creator of the execution sets input.steps (validated definition copy).
  const steps = input?.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    await prisma.workflowExecution.update({
      where: { id: exec.id },
      data: { status: "failed", error: "Workflow execution has no step plan.", finishedAt: new Date() },
    });
    return;
  }
  const tasks = await prisma.agentTask.findMany({ where: { workflowExecutionId: exec.id } });
  const failed = tasks.find((t) => t.status === "failed");
  if (failed) {
    await prisma.workflowExecution.update({
      where: { id: exec.id },
      data: { status: "failed", error: `Step ${failed.type} failed: ${failed.error ?? "unknown"}`, finishedAt: new Date(), updatedAt: new Date() },
    });
    return;
  }
  const byStep = new Map<string, (typeof tasks)[number]>();
  for (const s of steps) {
    byStep.set(s.key, tasks.find((t) => t.type === s.key) as (typeof tasks)[number]);
  }
  const remainingType = steps.map((s) => s.key);
  const remainingType2 = remainingType.filter((k) => !byStep.has(k) || !byStep.get(k));
  void remainingType2;

  const pending = steps.filter((s) => !tasks.some((t) => t.type === s.key));
  if (pending.length === 0) {
    const allDone = tasks.every((t) => t.status === "succeeded" || t.status === "waiting_for_approval");
    const blockers = tasks.filter((t) => t.status === "waiting_for_approval");
    await prisma.workflowExecution.update({
      where: { id: exec.id },
      data: {
        status: blockers.length > 0 ? "waiting_for_approval" : !allDone ? "failed" : "succeeded",
        ...(blockers.length > 0 ? {} : { finishedAt: new Date() }),
        output: JSON.stringify({ tasks: tasks.map((t) => ({ step: t.type, status: t.status, mock: t.isMock })) }),
        updatedAt: new Date(),
      },
    });
    return;
  }

  for (const step of pending) {
    const depsOk = (step.needs ?? []).every((n) => {
      const dep = tasks.find((t) => t.type === n);
      return dep && ["succeeded", "waiting_for_approval"].includes(dep.status);
    });
    if (!depsOk) continue;
    await prisma.agentTask.create({
      data: {
        workspaceId: exec.workspaceId,
        type: step.key,
        agentKey: TASK_AGENT[step.key] ?? "director",
        status: "queued",
        inputRefs: exec.input,
        workflowExecutionId: exec.id,
      },
    });
  }
  await prisma.workflowExecution.update({
    where: { id: exec.id },
    data: { status: "running", startedAt: exec.startedAt ?? new Date(), updatedAt: new Date() },
  });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
