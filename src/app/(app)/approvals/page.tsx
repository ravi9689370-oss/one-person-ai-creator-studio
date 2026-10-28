import { ApprovalDecisionForm } from "@/components/forms/approval-decision";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterPills, param } from "@/components/ui/filters";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Approvals" };

const STATUS_FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "all", label: "All" },
];

export default async function ApprovalsPage({ searchParams }: { searchParams: { status?: string } }) {
  const ctx = await pageCtx();
  const status = param(searchParams.status) ?? "pending";
  const valid = STATUS_FILTERS.some((s) => s.value === status) && status !== "all" ? status : undefined;
  const items = await prisma.approvalRequest.findMany({
    where: { workspaceId: ctx.workspaceId, ...(valid ? { status: valid } : {}) },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <PageShell
      title="Approvals"
      subtitle="Human-in-the-loop gates: agent work that touches publishing, payments, or provider spend pauses here until you decide."
    >
      <FilterPills base="/approvals" param="status" current={status} options={STATUS_FILTERS} />
      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {pendingCount} item{pendingCount > 1 ? "s" : ""} waiting on you. Nothing proceeds while these are open.
        </div>
      )}
      <div className="space-y-4">
        {items.length === 0 ? (
          <Card><EmptyState title="Nothing to review" body="Approval requests appear when the pipeline needs your decision." action={{ label: "Open Studio Director", href: "/studio/director" }} /></Card>
        ) : (
          items.map((a) => (
            <Card key={a.id} title={a.title} actions={<StatusBadge status={a.status} />}>
              <p className="text-[11px] text-slate-400">
                object: {a.objectType} · id: {a.objectId} · requested {formatDate(a.createdAt)}
                {a.decidedById ? ` · decided ${formatDate(a.decidedAt)}` : ""}
              </p>
              {a.context && (
                <p className="mt-1 truncate font-mono text-[11px] text-slate-400">context: {a.context}</p>
              )}
              {a.decisionNote && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">note: {a.decisionNote}</p>}
              {a.status === "pending" && <ApprovalDecisionForm approvalId={a.id} />}
            </Card>
          ))
        )}
      </div>
    </PageShell>
  );
}
