/**
 * Notification service: in-app notifications are always persisted; external
 * delivery (Slack webhook / email) only occurs when those providers are
 * actually configured and marked verified in the integrations registry.
 */
import { prisma } from "@/lib/db";
import { providerEnv } from "@/lib/env";

export type NotificationType = "info" | "approval" | "failure" | "lead" | "payment" | "report";

export const notify = {
  async publish(
    workspaceId: string,
    input: { type: NotificationType; title: string; body?: string; link?: string; userId?: string }
  ): Promise<{ id: string }> {
    const n = await prisma.notification.create({
      data: {
        workspaceId,
        userId: input.userId ?? null,
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 1000),
        link: input.link,
      },
    });
    void this.deliverExternal(workspaceId, n).catch(() => undefined);
    return { id: n.id };
  },

  /** External delivery for owners (best effort, never blocks app flow). */
  async deliverExternal(workspaceId: string, n: { id: string; title: string; body?: string | null; type: string }) {
    const env = providerEnv();
    const integration = await prisma.integration.findUnique({
      where: { workspaceId_providerKey: { workspaceId, providerKey: "slack" } },
    });
    if (env.slackWebhookUrl && integration?.status === "configured") {
      try {
        const res = await fetch(env.slackWebhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: `*${n.title}* (${n.type})\n${n.body ?? ""}`,
          }),
          signal: AbortSignal.timeout(8_000),
        });
        if (res.ok) {
          await prisma.notification.update({ where: { id: n.id }, data: { deliveredExternal: true } });
        } else {
          await prisma.integration.update({
            where: { id: integration.id },
            data: { lastError: `Slack delivery HTTP ${res.status}`, lastErrorAt: new Date() },
          });
        }
      } catch (e) {
        await prisma.integration.update({
          where: { id: integration.id },
          data: { lastError: e instanceof Error ? e.message : "Slack delivery failed", lastErrorAt: new Date() },
        });
      }
    }
    // Email channel requires SMTP configuration; documented in docs/integrations.md.
  },

  async unreadCount(workspaceId: string, userId: string): Promise<number> {
    return prisma.notification.count({
      where: { workspaceId, readAt: null, OR: [{ userId: null }, { userId }] },
    });
  },
};
