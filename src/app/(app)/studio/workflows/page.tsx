import { ActionButtonOutline } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Workflows" };

type Def = { steps: { key: string; agentKey: string; needs: string[]; approval?: boolean }[] };

export default async function WorkflowsPage() {
  const ctx = await pageCtx();
  const defs = await prisma.workflowDefinition.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } });
  const execs = await prisma.workflowExecution.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { workflow: { select: { name: true } } },
  });

  return (
    <PageShell title="Workflows" subtitle="Multi-step agent pipelines with real approval gates - a step that requires approval pauses the run until you decide.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {defs.length === 0 ? (
          <Card className="lg:col-span-2"><EmptyState title="No workflows defined" body="Definitions register during onboarding (e.g. content_to_publish, dubb_multilang)." /></Card>
        ) : (
          defs.map((d) => {
            let parsed: Def | null = null;
            try { parsed = JSON.parse(d.definition) as Def; } catch { parsed = null; }
            return (
              <Card
                key={d.id}
                title={d.name}
                actions={<ActionButtonOutline endpoint="/api/workflows" body={{ workflowKey: d.key, intent: `manual run of ${d.key}` }} label="Run" doneMessage="Execution started." />}
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">{d.description}</p>
                <ol className="mt-3 space-y-1.5">
                  {(parsed?.steps ?? []).map((s, i) => (
                    <li key={s.key} className="flex items-center gap-2 text-xs">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-[#1a2148]">{i + 1}</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{s.key}</span>
                      <span className="text-slate-400">→ {s.agentKey}</span>
                      {s.approval && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">APPROVAL GATE</span>}
                      {s.needs.length > 0 && <span className="text-[10px] text-slate-400">after {s.needs.join(", ")}</span>}
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })
        )}
      </div>

      <Card title="Recent executions" dense>
        {execs.length === 0 ? (
          <EmptyState title="No executions yet" body="Run a workflow above to see step-by-step executions." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
            {execs.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{e.workflow.name}</p>
                  <p className="text-[11px] text-slate-400">trigger {e.trigger} · {formatRelative(e.createdAt)}{e.error ? ` · ${e.error}` : ""}</p>
                </div>
                <StatusBadge status={e.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
