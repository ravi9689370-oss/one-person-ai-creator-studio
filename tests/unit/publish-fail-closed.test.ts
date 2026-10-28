import { describe, expect, it, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Publish lifecycle, tested through the actual route handlers with a stubbed
 * session. Verifies the fail-closed publishing contract: when a platform is
 * not provider-connected, the attempt records a failure and fabricates nothing.
 */

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => null), // replaced below per-suite
}));

const sessionUser = { id: "", email: "creator@example.com" };

beforeAll(async () => {
  const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  const creator = await prisma.user.findUnique({ where: { email: "creator@example.com" } });
  if (creator) sessionUser.id = creator.id;
  const { getServerSession } = (await import("next-auth")) as { getServerSession: ReturnType<typeof vi.fn> };
  getServerSession.mockImplementation(async () => ({ user: sessionUser, expires: "2099-01-01T00:00:00.000Z" }));
});

describe("POST /api/distribution/[id] (publish attempt)", () => {
  it("fails closed with platform_not_connected when no authorized account exists", async () => {
    const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
    const creator = await prisma.user.findUnique({ where: { email: "creator@example.com" } });
    const post = await prisma.scheduledPost.create({
      data: {
        workspaceId: ws?.id ?? "",
        platform: "youtube",
        title: "Fail-closed publish test",
        caption: "never actually posted",
        assetIds: "[]",
        status: "approved",
        createdById: creator?.id ?? "",
      },
    });
    // Ensure no connected youtube account exists for this workspace.
    await prisma.socialAccount.upsert({
      where: { workspaceId_platform: { workspaceId: ws?.id ?? "", platform: "youtube" } },
      create: { workspaceId: ws?.id ?? "", platform: "youtube", status: "disconnected" },
      update: { status: "disconnected" },
    });

    const { POST } = await import("@/app/api/distribution/[id]/route");
    const req = new NextRequest(`http://localhost:3000/api/distribution/${post.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "attempt_publish" }),
    });
    const res = await POST(req, { params: { id: post.id } });
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { published: boolean; reason: string };
    expect(payload.published).toBe(false);
    expect(payload.reason).toBe("platform_not_connected");

    const after = await prisma.scheduledPost.findUnique({ where: { id: post.id } });
    expect(after?.status).toBe("failed");
    expect(after?.failureReason).toContain("Platform not connected");

    const publishedRow = await prisma.publishedPost.findFirst({ where: { scheduledPostId: post.id } });
    expect(publishedRow?.status).toBe("failed");
    expect(publishedRow?.url).toBeNull();
  });

  it("rejects attempts on already-published posts", async () => {
    const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
    const creator = await prisma.user.findUnique({ where: { email: "creator@example.com" } });
    const post = await prisma.scheduledPost.create({
      data: { workspaceId: ws?.id ?? "", platform: "tiktok", title: "Already published", assetIds: "[]", status: "published", createdById: creator?.id ?? "" },
    });
    const { POST } = await import("@/app/api/distribution/[id]/route");
    const req = new NextRequest(`http://localhost:3000/api/distribution/${post.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "attempt_publish" }),
    });
    const res = await POST(req, { params: { id: post.id } });
    const payload = (await res.json()) as { error?: { code?: string } };
    expect((res as { status: number }).status).toBe(409);
    expect(payload.error?.code).toBe("approval_required");
  });
});
