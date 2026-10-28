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

export const metadata = { title: "Workflow Executions" };

const STATUSES = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "waiting_for_approval", label: "Waiting approval" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function ExecutionsPage({ searchParams }: { searchParams: { status?: string } }) {
  const ctx = await pageCtx();
  const status = param(searchParams.status) ?? "all";
  const valid = STATUSES.some((s) => s.value === status) && status !== "all" ? status : undefined;
  const execs = await prisma.workflowExecution.findMany({
    where: { workspaceId: ctx.workspaceId, ...(valid ? { status: valid } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { workflow: { select: { name: true } } },
  });
  const tasks = await prisma.agentTask.findMany({
    where: { workspaceId: ctx.workspaceId, workflowExecutionId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, type: true, status: true, isMock: true, workflowExecutionId: true },
  });
  const tasksBy = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const key = t.workflowExecutionId ?? "";
    tasksBy.set(key, [...(tasksBy.get(key) ?? []), t]);
  }

  return (
    <PageShell title="Executions" subtitle="Each run of a workflow definition, with its spawned tasks.">
      <FilterPills base="/studio/executions" param="status" current={status} options={STATUSES} />
      <div className="space-y-4">
        {execs.length === 0 ? (
          <Card><EmptyState title="No executions" body="Run a pipeline from the Workflows page." action={{ label: "Open Workflows", href: "/studio/workflows" }} /></Card>
        ) : (
          execs.map((e) => (
            <Card
              key={e.id}
              title={`${e.workflow.name} · ${startedLabel(e)}`}
              actions={<StatusBadge status={e.status} />}
            >
              {e.error && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{e.error}</p>}
              <div className="flex flex-wrap gap-2">
                {(tasksBy.get(e.id) ?? []).map((t) => (
                  <Link key={t.id} href={`/studio/tasks/${t.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:border-indigo-300 dark:border-[#2c3560]">
                    <span className="font-mono">{t.type}</span>
                    <StatusBadge status={t.status} isMock={t.isMock} />
                  </Link>
                ))}
                {(tasksBy.get(e.id) ?? []).length === 0 && <p className="text-xs text-slate-400">{truncate(e.error ?? "No tasks spawned.", 120)}</p>}
              </div>
            </Card>
          ))
        )}
      </div>
    </PageShell>
  );
}

function startedLabel(e: { createdAt: Date }) {
  return e.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
