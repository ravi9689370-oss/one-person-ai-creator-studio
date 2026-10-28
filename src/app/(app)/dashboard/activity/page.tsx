import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterPills, param } from "@/components/ui/filters";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative, formatDate } from "@/lib/utils";

export const metadata = { title: "Activity" };

const STATUSES = [
  { value: "all", label: "All" },
  { value: "succeeded", label: "Succeeded" },
  { value: "waiting_for_approval", label: "Waiting approval" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
];

export default async function ActivityPage({ searchParams }: { searchParams: { status?: string } }) {
  const ctx = await pageCtx();
  const status = param(searchParams.status) ?? "all";
  const statusFilter = STATUSES.some((s) => s.value === status) && status !== "all" ? status : undefined;

  const tasks = await prisma.agentTask.findMany({
    where: { workspaceId: ctx.workspaceId, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, type: true, agentKey: true, status: true, summary: true, error: true, isMock: true, createdAt: true, finishedAt: true },
  });

  return (
    <PageShell title="Activity" subtitle="Full feed of agent work in your studio, newest first.">
      <FilterPills base="/dashboard/activity" param="status" current={status} options={STATUSES} />
      <Card title={`${tasks.length} tasks${status !== "all" ? ` · ${statusFilter}` : ""}`} dense>
        {tasks.length === 0 ? (
          <EmptyState
            title="No activity matches this filter"
            body="Agent tasks appear here as they run - start one from the Studio Director."
            action={{ label: "Open Studio Director", href: "/studio/director" }}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/studio/tasks/${t.id}`} className="text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100">
                    {t.type}
                  </Link>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {t.summary ?? t.agentKey}
                    {t.error ? ` · ${t.error}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusBadge status={t.status} isMock={t.isMock} />
                  <p className="mt-1 text-[11px] text-slate-400" title={formatDate(t.createdAt)}>{formatRelative(t.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
