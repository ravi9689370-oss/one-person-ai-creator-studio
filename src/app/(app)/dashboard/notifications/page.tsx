import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPills, param } from "@/components/ui/filters";
import { ActionButtonOutline } from "@/components/forms/action-button";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Notifications" };

const TYPES = [
  { value: "all", label: "All" },
  { value: "approval", label: "Approvals" },
  { value: "failure", label: "Failures" },
  { value: "lead", label: "Leads" },
  { value: "payment", label: "Payments" },
  { value: "report", label: "Reports" },
  { value: "info", label: "Info" },
];

export default async function NotificationsPage({ searchParams }: { searchParams: { type?: string; read?: string } }) {
  const ctx = await pageCtx();
  const type = param(searchParams.type) ?? "all";
  const showRead = param(searchParams.read) === "read";

  const notifications = await prisma.notification.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      OR: [{ userId: null }, { userId: ctx.userId }],
      ...(type !== "all" && TYPES.some((t) => t.value === type) ? { type } : {}),
      ...(!showRead ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const unread = await prisma.notification.count({
    where: { workspaceId: ctx.workspaceId, readAt: null, OR: [{ userId: null }, { userId: ctx.userId }] },
  });

  return (
    <PageShell
      title="Notifications"
      subtitle="Approvals, failures, leads, payments, and morning briefs land here. External email/slack delivery activates once a provider is configured."
      actions={unread > 0 ? <ActionButtonOutline endpoint="/api/notifications" body={{ all: true }} label={`Mark all read (${unread})`} doneMessage="All notifications marked read." /> : undefined}
    >
      <div className="flex flex-wrap gap-3">
        <FilterPills base="/dashboard/notifications" param="type" current={type} options={TYPES} />
        <FilterPills base="/dashboard/notifications" param="read" current={showRead ? "read" : "unread"} options={[{ value: "unread", label: "Unread" }, { value: "read", label: "All (incl. read)" }]} />
      </div>
      <Card title={`${notifications.length} notifications`} dense>
        {notifications.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body="Notifications appear when items need your review, tasks fail, or reports generate."
            action={{ label: "Open Studio Director", href: "/studio/director" }}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
            {notifications.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.readAt ? "opacity-70" : ""}`}>
                <StatusBadge status={n.type === "failure" ? "failed" : n.readAt ? "queued" : "approved"} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">{formatDate(n.createdAt)} · type: {n.type}{n.deliveredExternal ? " · delivered externally" : " · in-app"}</p>
                </div>
                {n.link && (
                  <a href={n.link} className="shrink-0 text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
                    Open →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
