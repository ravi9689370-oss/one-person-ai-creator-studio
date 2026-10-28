/**
 * Central approval queue. Every sensitive decision (scripts, voice, video,
 * translations, thumbnails, public posts, paid actions) flows through here and
 * is recorded with actor, timestamp, action, and object reference.
 */
import { prisma } from "@/lib/db";
import { audit } from "@/server/api";
import { notify } from "@/server/notifications";
import { finalizeTask } from "@/server/agents/director";

export type ApprovalObjectType = "script" | "voice" | "video" | "localization" | "thumbnail" | "post" | "sale" | "product" | "expense";

export async function createApprovalRequest(
  workspaceId: string,
  input: {
    objectType: ApprovalObjectType | string;
    objectId: string;
    title: string;
    context?: Record<string, unknown>;
    requestedById?: string | null;
  },
  actor?: { userId: string; workspaceId: string; role?: string }
): Promise<{ id: string }> {
  const request = await prisma.approvalRequest.create({
    data: {
      workspaceId,
      objectType: input.objectType,
      objectId: input.objectId,
      title: input.title,
      context: input.context ? JSON.stringify(input.context).slice(0, 6000) : null,
      requestedById: input.requestedById ?? actor?.userId ?? null,
      status: "pending",
    },
  });
  await notify.publish(workspaceId, {
    type: "approval",
    title: "Approval required",
    body: input.title,
    link: "/approvals",
  });
  return { id: request.id };
}

/** Decisions apply per-type side effects; payment state still only comes from verified provider events. */
export async function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected" | "changes_requested",
  actorId: string,
  note?: string,
  ip?: string
): Promise<void> {
  const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
  if (!approval) throw new Error("Approval request not found");
  if (approval.status !== "pending") throw new Error("Approval was already decided");

  await prisma.approvalRequest.update({
    where: { id: approval.id },
    data: {
      status: decision,
      decidedById: actorId,
      decisionNote: note ?? null,
      decidedAt: new Date(),
    },
  });
  await audit(
    { userId: actorId, workspaceId: approval.workspaceId, role: "member" },
    `approval.${decision}`,
    approval.objectType,
    approval.objectId,
    { note: note ?? null },
    ip
  );

  switch (approval.objectType) {
    case "script":
      await prisma.script
        .update({
          where: { id: approval.objectId },
          data: { status: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "needs_revision" },
        })
        .catch(() => undefined);
      break;
    case "voice": {
      const job = await prisma.voiceJob.findUnique({ where: { id: approval.objectId } });
      if (job && decision === "approved" && job.status === "waiting_for_approval") {
        await prisma.voiceJob.update({ where: { id: job.id }, data: { status: "succeeded" } });
      }
      break;
    }
    case "localization":
      await prisma.localizationVariant
        .update({
          where: { id: approval.objectId },
          data: { status: decision === "approved" ? "approved" : "in_review", reviewNotes: note ?? null },
        })
        .catch(() => undefined);
      break;
    case "video": {
      const job = await prisma.videoJob.findUnique({ where: { id: approval.objectId } });
      if (job && decision !== "approved") {
        await prisma.videoJob.update({ where: { id: job.id }, data: { status: "failed", error: "Rejected in review." } });
      }
      break;
    }
    case "thumbnail":
      await prisma.thumbnail
        .update({ where: { id: approval.objectId }, data: { status: decision === "rejected" ? "rejected" : "generated" } })
        .catch(() => undefined);
      break;
    case "post": {
      const post = await prisma.scheduledPost.findUnique({ where: { id: approval.objectId } });
      if (post) {
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data:
            decision === "approved"
              ? { status: "approved" }
              : { status: "draft", failureReason: "Changes requested in approval review." },
        });
      }
      break;
    }
    default:
      break;
  }

  // Link decision back to any agent task waiting on this approval.
  const task = await prisma.agentTask.findFirst({ where: { approvalRequestId: approvalId } });
  if (task && task.status === "waiting_for_approval") {
    if (decision === "approved") {
      await prisma.agentTask.update({ where: { id: task.id }, data: { status: "succeeded", finishedAt: new Date() } });
      await finalizeTask(task.id, { status: "succeeded", summary: `Approved via request ${approval.id}.` }, task.workspaceId);
    } else {
      await prisma.agentTask.update({
        where: { id: task.id },
        data: { status: "failed", error: `Approval ${decision}${note ? `: ${note}` : ""}`, finishedAt: new Date() },
      });
    }
  }
}

/** Attach a pending task to an approval request (idempotent). */
export async function linkTaskToApproval(taskId: string, approvalId: string) {
  await prisma.agentTask.updateMany({ where: { id: taskId, approvalRequestId: null }, data: { approvalRequestId: approvalId } });
}
