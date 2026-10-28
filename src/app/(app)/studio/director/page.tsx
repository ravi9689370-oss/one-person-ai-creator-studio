import Link from "next/link";
import { InlineForm } from "@/components/ui/inline-form";
import { ActionButtonOutline } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { TASK_TYPES } from "@/server/agents/types";
import { titleCase } from "@/lib/utils";

export const metadata = { title: "Studio Director" };

export default async function DirectorPage() {
  const ctx = await pageCtx();
  const recent = await prisma.agentTask.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, type: true, status: true, summary: true, isMock: true, createdAt: true },
  });
  const agents = await prisma.agent.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } });

  return (
    <PageShell
      title="Studio Director"
      subtitle="Describe what you want in plain language - the Director classifies your intent, plans the work, routes it to the right agent, and records everything."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Ask the Director">
            <InlineForm
              endpoint="/api/ai/tasks"
              submitLabel="Run it"
              successMessage="Task queued - if it finishes instantly you'll see it in the feed below."
              fields={[
                {
                  name: "intent",
                  label: "What do you need?",
                  type: "textarea",
                  required: true,
                  min: 3,
                  placeholder: "e.g. research and script a 60-second short about my new course  |  three shorts from last week's video  |  generate a voiceover for script X",
                },
              ]}
            >
              <p className="text-[11px] text-slate-400">
                The Director picks a task type automatically, or you can be explicit. Paid-provider jobs run in development-fixture mode until credentials are configured.
              </p>
            </InlineForm>
          </Card>

          <Card title="Recent work" actions={<Link href="/studio/tasks" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400">All tasks →</Link>} dense>
            {recent.length === 0 ? (
              <EmptyState
                title="No tasks yet"
                body="Give the Director your first instruction above - the plan appears here in real time."
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/studio/tasks/${t.id}`} className="text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100">{t.type}</Link>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t.summary}</p>
                    </div>
                    <StatusBadge status={t.status} isMock={t.isMock} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Available capabilities">
            <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              {TASK_TYPES.map((t) => (
                <li key={t} className="rounded border border-slate-100 px-2 py-1 dark:border-[#232b4d]">
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{t}</span> · {titleCase(t)}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Agent roster" actions={<Link href="/studio/agents" className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Manage →</Link>}>
            <ul className="space-y-1.5">
              {agents.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{a.name}</span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Prewired workflows">
            {agents.length === 0 ? null : (
              <>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Kick off multi-step production pipelines from the Workflows page.</p>
                <ActionButtonOutline endpoint="/api/workflows" body={{ workflowKey: "content_to_publish", intent: "produce the next content topic start-to-finish" }} label="Run content → publish pipeline" doneMessage="Workflow execution started." />
              </>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
