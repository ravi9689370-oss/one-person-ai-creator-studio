import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { createApprovalRequest, decideApproval } from "@/server/approvals";

let workspaceId = "";
let creatorId = "";

beforeAll(async () => {
  const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  const creator = await prisma.user.findUnique({ where: { email: "creator@example.com" } });
  workspaceId = ws?.id ?? "";
  creatorId = creator?.id ?? "";
  expect(workspaceId).toBeTruthy();
});

describe("approval gate", () => {
  it("blocks re-decision and only flips the object on approved", async () => {
    const script = await prisma.script.create({
      data: { workspaceId, title: "Approval-gated script", status: "draft", createdById: creatorId },
    });

    const request = await createApprovalRequest(
      workspaceId,
      { objectType: "script", objectId: script.id, title: "Test gate", context: { note: "vitest" } },
      { userId: creatorId, workspaceId, role: "owner" },
    );
    const created = await prisma.approvalRequest.findUnique({ where: { id: request.id } });
    expect(created?.status).toBe("pending");

    await decideApproval(request.id, "approved", creatorId, "ship it");
    const decided = await prisma.approvalRequest.findUnique({ where: { id: request.id } });
    expect(decided?.status).toBe("approved");
    expect(decided?.decisionNote).toBe("ship it");
    const updatedScript = await prisma.script.findUnique({ where: { id: script.id } });
    expect(updatedScript?.status).toBe("approved");

    await expect(decideApproval(request.id, "rejected", creatorId)).rejects.toThrow(/already decided/i);
  });

  it("rejecting a script sends it to rejected, changes_requested needs revisions", async () => {
    for (const decision of ["rejected", "changes_requested"] as const) {
      const script = await prisma.script.create({
        data: { workspaceId, title: `Gate ${decision}`, status: "draft", createdById: creatorId },
      });
      const request = await createApprovalRequest(
        workspaceId,
        { objectType: "script", objectId: script.id, title: `Test gate ${decision}` },
        { userId: creatorId, workspaceId, role: "owner" },
      );
      await decideApproval(request.id, decision, creatorId);
      const s = await prisma.script.findUnique({ where: { id: script.id } });
      expect(s?.status).toBe(decision === "rejected" ? "rejected" : "needs_revision");
    }
  });

  it("approved agent task resumes to succeeded when approval arrives", async () => {
    const approval = await prisma.approvalRequest.create({
      data: { workspaceId, objectType: "post", objectId: " vitest-post ".trim(), title: "gate-task approval" },
    });
    const task = await prisma.agentTask.create({
      data: { workspaceId, type: "publish.prepare_package", agentKey: "distribution", status: "waiting_for_approval", approvalRequestId: approval.id },
    });
    await decideApproval(approval.id, "approved", creatorId, "ok");
    const t = await prisma.agentTask.findUnique({ where: { id: task.id } });
    expect(t?.status).toBe("succeeded");
  });
});
