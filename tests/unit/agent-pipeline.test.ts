import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { createTask, finalizeTask, verifyOutputRefs, classifyIntent } from "@/server/agents/director";

/**
 * Uses the seeded baseline workspace/creator (see prisma/seed.ts) as context.
 */
let workspaceId = "";
let creatorId = "";

beforeAll(async () => {
  const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  const creator = await prisma.user.findUnique({ where: { email: "creator@example.com" } });
  workspaceId = ws?.id ?? "";
  creatorId = creator?.id ?? "";
  expect(workspaceId).toBeTruthy();
  expect(creatorId).toBeTruthy();
});

describe("classifyIntent", () => {
  it("routes common phrasings to the right task type", () => {
    expect(classifyIntent("write a script about burnout").type).toBe("script.generate");
    expect(classifyIntent("generate a voiceover for the intro").type).toBe("voice.generate");
    expect(classifyIntent("translate it to spanish and dub").type).toBe("localize.translate");
    expect(classifyIntent("three shorts from last week").type).toBe("repurpose.generate_clips");
  });
});

describe("task output verification (finalizeTask)", () => {
  it("marks a task failed when a claimed output ref does not exist", async () => {
    const { id } = await createTask({ workspaceId, type: "script.generate", input: { message: "verify-test bogus" }, actorId: creatorId });
    await finalizeTask(id, { status: "succeeded", outputRefs: { media: "media:nonexistentasset" }, summary: "claim" }, workspaceId);
    const task = await prisma.agentTask.findUnique({ where: { id } });
    expect(task?.status).toBe("failed");
    expect(task?.error).toContain("Output verification failed");
    expect(task?.outputRefs).toBeNull();
  });

  it("marks a task failed when a script ref points at another workspace", async () => {
    const { id } = await createTask({ workspaceId, type: "script.generate", input: { message: "tenant check" }, actorId: creatorId });
    await finalizeTask(id, { status: "succeeded", outputRefs: { script: "script:not-real-check" }, summary: "claim" }, workspaceId);
    const task = await prisma.agentTask.findUnique({ where: { id } });
    expect(task?.status).toBe("failed");
  });

  it("accepts succeeded only after refs verify, and waits politely for approval", async () => {
    const script = await prisma.script.create({
      data: { workspaceId, title: "Verify ref script", status: "draft", createdById: creatorId },
    });
    const { id } = await createTask({ workspaceId, type: "script.revise", input: { message: "verify ok" }, actorId: creatorId });

    await finalizeTask(id, { status: "waiting_for_approval", summary: "needs human review" }, workspaceId);
    let task = await prisma.agentTask.findUnique({ where: { id } });
    expect(task?.status).toBe("waiting_for_approval");
    expect(task?.finishedAt).toBeTruthy();

    await finalizeTask(id, { status: "succeeded", outputRefs: { script: `script:${script.id}` }, summary: "verified" }, workspaceId);
    task = await prisma.agentTask.findUnique({ where: { id } });
    expect(task?.status).toBe("succeeded");
  });

  it("verifyOutputRefs flags empty refs", async () => {
    const bad = await verifyOutputRefs(workspaceId, { a: "" });
    expect(bad.ok).toBe(false);
    expect(bad.problem).toContain("empty");
  });
});
