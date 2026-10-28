import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/authz";
import { formatRelative } from "@/lib/utils";

export async function ApprovalQueueWidget() {
  const ctx = await requireSession({ session: await getSession() });
  const pending = await prisma.approvalRequest.findMany({
    where: { workspaceId: ctx.workspaceId, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, objectType: true, title: true, createdAt: true },
  });
  return (
    <Card title="Approval queue" actions={<Link href="/approvals" className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Open →</Link>}>
      {pending.length === 0 ? (
        <p className="py-2 text-sm text-slate-500">Nothing waiting on you. 👌</p>
      ) : (
        <ul className="space-y-2.5">
          {pending.map((a) => (
            <li key={a.id} className="text-sm">
              <Link href="/approvals" className="font-medium text-slate-800 hover:underline dark:text-slate-100">
                {a.title}
              </Link>
              <span className="block text-xs text-slate-400">
                {a.objectType} · {formatRelative(a.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function NextActionsWidget(props: {
  failingTasks: number;
  pendingApprovals: number;
  integrationAlerts: number;
  hotLeads: number;
}) {
  const actions: { label: string; href: string; tone: string }[] = [];
  if (props.pendingApprovals > 0)
    actions.push({ label: `Review ${props.pendingApprovals} pending approval${props.pendingApprovals > 1 ? "s" : ""}`, href: "/approvals", tone: "amber" });
  if (props.failingTasks > 0)
    actions.push({ label: `Inspect ${props.failingTasks} failed agent task${props.failingTasks > 1 ? "s" : ""}`, href: "/studio/tasks?status=failed", tone: "rose" });
  if (props.hotLeads > 0)
    actions.push({ label: `${props.hotLeads} high-value lead${props.hotLeads > 1 ? "s" : ""} need attention`, href: "/crm/leads?qualification=high_value", tone: "indigo" });
  if (props.integrationAlerts > 0)
    actions.push({ label: `${props.integrationAlerts} integration alert${props.integrationAlerts > 1 ? "s" : ""}`, href: "/integrations/status", tone: "rose" });
  if (actions.length === 0)
    actions.push({ label: "Plan today's batch in the Director", href: "/studio/director", tone: "indigo" });

  return (
    <Card title="Recommended next actions">
      <ul className="space-y-2.5">
        {actions.map((a) => (
          <li key={a.href + a.label}>
            <Link
              href={a.href}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition hover:shadow-sm border-${a.tone}-200 bg-${a.tone}-50 text-${a.tone}-900 dark:bg-[#1a2148] dark:text-slate-200 dark:border-[#2c3560]`}
            >
              {a.label}
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function getSession() {
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth");
  return getServerSession(authOptions);
}
