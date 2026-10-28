import type { AgentTask } from "@prisma/client";

export type TaskOutput = {
  status: "succeeded" | "failed" | "waiting_for_approval";
  summary: string;
  outputRefs?: Record<string, string>;
  error?: string;
  isMock?: boolean;
};

export type TaskContext = { workspaceId: string; userId?: string | null };

export type TaskHandler = (task: AgentTask, ctx: TaskContext) => Promise<TaskOutput>;

export type TaskIntent = {
  type: string; // task type key
  input: Record<string, unknown>;
  summary: string;
};

/** Task types registered in the platform. */
export const TASK_TYPES = [
  "research.brief",
  "strategy.ideate",
  "script.generate",
  "script.revise",
  "voice.generate",
  "transcribe.audio",
  "localize.translate",
  "localize.dub",
  "video.assemble",
  "video.render",
  "thumbnail.concept",
  "repurpose.generate_clips",
  "publish.prepare_package",
  "analytics.report",
  "quality.review",
  "maya.reply",
  "lead.qualify",
  "brief.morning",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export function isTaskType(v: string): v is TaskType {
  return (TASK_TYPES as readonly string[]).includes(v);
}
