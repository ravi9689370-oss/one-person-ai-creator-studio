import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSession } from "@/lib/authz";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { formatRelative, formatMoney } from "@/lib/utils";
import Link from "next/link";
import { ApprovalQueueWidget, NextActionsWidget } from "@/components/dashboard/widgets";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Dashboard" };

const DAY = 24 * 60 * 60 * 1000;

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const sessionCtx = await requireSession({ session });
  const workspaceId = sessionCtx.workspaceId;
  const now = new Date();

  const [
    awaitingApproval,
    scheduledCount,
    failingTasks,
    recentTasks,
    workspace,
  ] = await Promise.all([
    prisma.approvalRequest.count({ where: { workspaceId: workspaceId, status: "pending" } }),
    prisma.scheduledPost.count({ where: { workspaceId: workspaceId, status: { in: ["approved", "queued"] } } }),
    prisma.agentTask.count({ where: { workspaceId: workspaceId, status: "failed" } }),
    prisma.agentTask.findMany({
      where: { workspaceId: workspaceId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, type: true, status: true, agentKey: true, summary: true, isMock: true, createdAt: true },
    }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, currency: true } }),
  ]);

  const revenueAgg = await prisma.revenueRecord.aggregate({
    where: { workspaceId: workspaceId, kind: "sale", occurredAt: { gte: new Date(now.getTime() - 30 * DAY) } },
    _sum: { amountCents: true },
  });
  const leadCount = await prisma.lead.count({ where: { workspaceId: workspaceId } });
  const hotLeads = await prisma.lead.count({ where: { workspaceId: workspaceId, qualification: "high_value" } });
  const published30 = await prisma.publishedPost.count({
    where: { workspaceId: workspaceId, publishedAt: { gte: new Date(now.getTime() - 30 * DAY) } },
  });

  const revenueCents = revenueAgg._sum.amountCents ?? 0;
  const integrationAlerts = await prisma.integration.count({
    where: { workspaceId: workspaceId, status: { in: ["error"] } },
  });

  return (
    <PageShell
      title="Overview"
      subtitle={`Good to see you - ${workspace?.name ?? "your studio"} at a glance.`}
      actions={<Link href="/studio/director" className="btn-outline">Ask the Director</Link>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting your approval" value={String(awaitingApproval)} href="/approvals" hint="Items pause execution until reviewed." />
        <StatCard label="Scheduled posts queued" value={String(scheduledCount)} href="/distribution/queue" hint="Approved publishing packages only." />
        <StatCard label="Revenue (30d)" value={formatMoney(revenueCents, workspace?.currency ?? "USD")} href="/analytics/revenue" hint="From verified sale records." />
        <StatCard label="Leads" value={String(leadCount)} href="/crm/leads" hint={`${hotLeads} flagged high-value.`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Recent agent activity">
            {recentTasks.length === 0 ? (
              <EmptyState
                title="No agent activity yet"
                body="Run your first workflow from the Studio Director - research, scripts, and publishing packages will appear here."
                action={{ label: "Open Studio Director", href: "/studio/director" }}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {recentTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/studio/tasks/${t.id}`} className="text-sm font-medium text-slate-800 hover:underline dark:text-slate-100">
                        {t.type}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{t.summary ?? t.agentKey}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={t.status} isMock={t.isMock} />
                      <span className="text-xs text-slate-400">{formatRelative(t.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <NextActionsWidget
            failingTasks={failingTasks}
            pendingApprovals={awaitingApproval}
            integrationAlerts={integrationAlerts}
            hotLeads={hotLeads}
          />
        </div>

        <div className="space-y-6">
          <ApprovalQueueWidget />
          <Card title="Published content (30d)">
            <p className="text-3xl font-bold">{published30}</p>
            <p className="mt-1 text-xs text-slate-500">{published30 === 0 ? "No published content recorded yet - publish manually or once a platform is connected." : "Verified publishing records only."}</p>
            <Link href="/distribution/posts" className="mt-3 inline-block text-sm font-semibold text-indigo-700 dark:text-indigo-400">View posts →</Link>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function StatCard({ label, value, href, hint }: { label: string; value: string; href: string; hint?: string }) {
  return (
    <Link href={href} className="card group block p-4 transition hover:shadow-pop">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1.5 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Link>
  );
}

