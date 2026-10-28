/**
 * Post lifecycle: request approval (gate), attempt publish (records the real
 * outcome; without a connected platform it fails honestly and is retryable),
 * and manual status fixes for record-keeping.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, audit, withAuth } from "@/server/api";

type P = { params: { id: string } };

const actionSchema = z.object({
  action: z.enum(["request_approval", "attempt_publish", "mark_published", "cancel"]),
  externalUrl: z.string().url().optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: P) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid action.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });

  const post = await prisma.scheduledPost.findFirst({ where: { id: params.id, workspaceId: auth.ctx.workspaceId } });
  if (!post) return fail(404, "not_found", "Post not found.");

  if (parsed.data.action === "request_approval") {
    if (["pending_approval", "approved", "queued", "published"].includes(post.status)) {
      return fail(409, "invalid_state", `Post is ${post.status}; approval already handled.`);
    }
    const { createApprovalRequest } = await import("@/server/approvals");
    const approval = await createApprovalRequest(
      auth.ctx.workspaceId,
      {
        objectType: "post",
        objectId: post.id,
        title: `Publish package: ${post.title} (${post.platform})`,
        context: { postId: post.id, platform: post.platform, caption: post.caption, scheduledFor: post.scheduledFor },
      },
      auth.ctx
    );
    await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "pending_approval", approvalRequestId: approval.id } });
    await audit(auth.ctx, "post.request_approval", "scheduled_post", post.id);
    return ok({ approvalId: approval.id }, { status: 201 });
  }

  if (parsed.data.action === "attempt_publish") {
    if (post.status !== "approved") {
      return fail(409, "approval_required", "Publishing is blocked until the recorded approval exists. Request approval first.");
    }
    const account = await prisma.socialAccount.findFirst({
      where: { workspaceId: auth.ctx.workspaceId, platform: post.platform },
    });
    const platformReady = account?.status === "connected";
    if (!platformReady) {
      // Fail closed and honestly: no connected platform = no pretend publish.
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "failed", failureReason: `Platform not connected (${post.platform}). Publishing adapter requires OAuth credentials and authorization - see Integrations.` },
      });
      await prisma.publishedPost.create({
        data: {
          workspaceId: auth.ctx.workspaceId,
          scheduledPostId: post.id,
          platform: post.platform,
          status: "failed",
          caption: post.caption,
          externalId: "",
          publishedAt: new Date(),
          metricsSource: "none",
        },
      });
      await audit(auth.ctx, "post.publish_failed", "scheduled_post", post.id, { reason: "platform_not_connected" });
      return ok({ published: false, reason: "platform_not_connected" }, { status: 200 });
    }
    // With a real connected adapter, the provider call happens here; until the
    // adapter is verified this path records a provider-pending state instead
    // of inventing a successful public post.
    return fail(501, "adapter_unavailable", "Platform adapter is connected but not yet verified; no fake posts are created.");
  }

  if (parsed.data.action === "mark_published") {
    if (!parsed.data.externalUrl) return fail(422, "url_required", "Provide the url of the manually published post (provenance is recorded).");
    const published = await prisma.publishedPost.create({
      data: {
        workspaceId: auth.ctx.workspaceId,
        scheduledPostId: post.id,
        platform: post.platform,
        status: "published",
        caption: post.caption,
        url: parsed.data.externalUrl,
        publishedAt: new Date(),
        metricsSource: "manual",
      },
    });
    await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "published", publishedPostId: published.id } });
    await audit(auth.ctx, "post.mark_published", "published_post", published.id, { manual: true });
    return ok({ publishedPostId: published.id });
  }

  // cancel
  await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "cancelled" } });
  await audit(auth.ctx, "post.cancel", "scheduled_post", post.id);
  return ok({ cancelled: true });
}
