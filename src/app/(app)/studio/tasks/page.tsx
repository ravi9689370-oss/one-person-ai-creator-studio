import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterPills, param } from "@/components/ui/filters";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { truncate } from "@/lib/utils";

export const metadata = { title: "Tasks" };

const STATUSES = [
  { value: "all", label: "All" },
  { value: "waiting_for_approval", label: "Waiting approval" },
  { value: "succeeded", label: "Succeeded" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function TasksPage({ searchParams }: { searchParams: { status?: string; agent?: string } }) {
  const ctx = await pageCtx();
  const status = param(searchParams.status) ?? "all";
  const agent = param(searchParams.agent);
  const valid = STATUSES.some((s) => s.value === status) && status !== "all" ? status : undefined;

  const tasks = await prisma.agentTask.findMany({
    where: { workspaceId: ctx.workspaceId, ...(valid ? { status: valid } : {}), ...(agent ? { agentKey: agent } : {}) },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: { id: true, type: true, agentKey: true, status: true, summary: true, isMock: true, attempts: true, createdAt: true, finishedAt: true, workflowExecutionId: true },
  });

  return (
    <PageShell
      title="Agent Tasks"
      subtitle="Every unit of agent work with verified outputs. Failed tasks keep their error - nothing is silently retried into fake success."
    >
      <FilterPills base="/studio/tasks" param="status" current={status} options={STATUSES} />
      <Card dense>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks match" body="Start one from the Studio Director." action={{ label: "Open Studio Director", href: "/studio/director" }} />
        ) : (
          <DataTable
            rows={tasks}
            rowHref={(t) => `/studio/tasks/${t.id}`}
            columns={[
              { header: "Task", render: (t) => <div><span className="font-semibold">{t.type}</span>{t.workflowExecutionId && <span className="ml-2 text-[11px] text-slate-400">in workflow</span>}</div> },
              { header: "Agent", render: (t) => <span className="font-mono text-xs">{t.agentKey}</span>, hideOnMobile: true },
              { header: "Summary", render: (t) => <span className="text-xs text-slate-500 dark:text-slate-400">{truncate(t.summary, 80)}</span> },
              { header: "Status", render: (t) => <StatusBadge status={t.status} isMock={t.isMock} /> },
              { header: "Attempts", render: (t) => <span className="text-xs">{t.attempts}/3</span>, hideOnMobile: true },
              { header: "Created", render: (t) => <span className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> },
            ]}
          />
        )}
      </Card>
      <p className="text-xs text-slate-400">
        Select a row for input refs, output refs, and the approval state. <Link href="/approvals" className="font-semibold text-indigo-700 dark:text-indigo-400">Approvals live here</Link> until you decide them.
      </p>
    </PageShell>
  );
}
