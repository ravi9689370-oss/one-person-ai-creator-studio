import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  const ctx = await pageCtx();
  const agents = await prisma.agent.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } });
  const runCounts = await prisma.agentTask.groupBy({ by: ["agentKey"], where: { workspaceId: ctx.workspaceId }, _count: { agentKey: true } });
  const runsBy = Object.fromEntries(runCounts.map((r) => [r.agentKey, r._count.agentKey]));
  const fails = await prisma.agentTask.groupBy({ by: ["agentKey"], where: { workspaceId: ctx.workspaceId, status: "failed" }, _count: { agentKey: true } });
  const failBy = Object.fromEntries(fails.map((r) => [r.agentKey, r._count.agentKey]));

  return (
    <PageShell title="Agents" subtitle="The 13-worker studio roster. Every agent runs inside the verified task pipeline - no side-channel magic.">
      <Card dense>
        {agents.length === 0 ? (
          <EmptyState title="No agents registered" body="Agents register during workspace onboarding from the built-in roster." action={{ label: "Complete onboarding", href: "/onboarding" }} />
        ) : (
          <DataTable
            rows={agents}
            columns={[
              { header: "Agent", render: (a) => <span className="font-semibold text-slate-800 dark:text-slate-100">{a.name}</span> },
              { header: "Key", render: (a) => <span className="font-mono text-xs">{a.key}</span>, hideOnMobile: true },
              { header: "Role", render: (a) => <span className="text-xs text-slate-500 dark:text-slate-400">{a.description}</span> },
              { header: "Health", render: (a) => <StatusBadge status={a.status} /> },
              { header: "Runs", render: (a) => <span>{runsBy[a.key] ?? 0}{(failBy[a.key] ?? 0) > 0 ? <span className="ml-1 text-xs text-rose-600">({failBy[a.key]} failed)</span> : null}</span> },
              { header: "Last run", render: (a) => <span className="text-xs text-slate-400">{formatRelative(a.lastRunAt)}</span> },
            ]}
          />
        )}
      </Card>
    </PageShell>
  );
}
