import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Task Detail" };

function RefRow({ label, raw }: { label: string; raw: string | null }) {
  let refs: Record<string, string> = {};
  if (raw) {
    try { refs = JSON.parse(raw) as Record<string, string>; } catch { refs = { raw }; }
  }
  const entries = Object.entries(refs);
  if (entries.length === 0) return <p className="text-xs text-slate-400">None recorded.</p>;
  return (
    <ul className="space-y-1 text-xs">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center gap-2 font-mono">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold dark:bg-[#1a2148]">{k}</span>
          <span className="truncate text-slate-600 dark:text-slate-300">{v}</span>
          {v.startsWith("media:") && (
            <a href={`/api/media/${v.slice(6)}/raw`} className="font-sans text-[11px] font-semibold text-indigo-700 hover:underline dark:text-indigo-400">open asset →</a>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const ctx = await pageCtx();
  const task = await prisma.agentTask.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
  });
  if (!task) notFound();

  const approval = task.approvalRequestId
    ? await prisma.approvalRequest.findUnique({ where: { id: task.approvalRequestId } })
    : null;

  return (
    <PageShell
      title={task.type}
      subtitle={`run by ${task.agentKey} · ${formatDate(task.createdAt)}${task.finishedAt ? ` · finished ${formatDate(task.finishedAt)}` : ""}`}
      actions={<Link href="/studio/tasks" className="btn-outline">All tasks</Link>}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Summary & outcome">
            {task.summary && <p className="text-sm text-slate-700 dark:text-slate-200">{task.summary}</p>}
            {task.error && (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{task.error}</p>
            )}
            {task.isMock && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                DEVELOPMENT FIXTURE — this output was produced in mock-provider mode, not by a real external AI provider.
              </p>
            )}
            {!task.summary && !task.error && (
              <p className="text-sm text-slate-500">No result noted yet{task.status === "running" ? " - the task is running." : "."}</p>
            )}
          </Card>
          <Card title="Output refs (verified)"><RefRow label="Output" raw={task.outputRefs} /></Card>
        </div>
        <div className="space-y-6">
          <Card title="Status">
            <StatusBadge status={task.status} isMock={task.isMock} />
            <dl className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex justify-between"><dt>attempts</dt><dd>{task.attempts} / {task.maxAttempts}</dd></div>
              <div className="flex justify-between"><dt>queued</dt><dd>{formatDate(task.createdAt)}</dd></div>
              <div className="flex justify-between"><dt>started</dt><dd>{formatDate(task.startedAt)}</dd></div>
              <div className="flex justify-between"><dt>finished</dt><dd>{formatDate(task.finishedAt)}</dd></div>
            </dl>
          </Card>
          <Card title="Input refs"><RefRow label="Input" raw={task.inputRefs} /></Card>
          {approval && (
            <Card title="Approval record" actions={<Link href="/approvals" className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Open →</Link>}>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{approval.title}</p>
              <StatusBadge status={approval.status} />
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
