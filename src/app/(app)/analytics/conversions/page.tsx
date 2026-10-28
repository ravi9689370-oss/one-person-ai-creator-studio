import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Conversion Analytics" };

export default async function ConversionsPage() {
  const ctx = await pageCtx();
  const [workspace, mayaLeads, wonLeads, appts, events] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } }),
    prisma.lead.findMany({ where: { workspaceId: ctx.workspaceId, mayaConversationId: { not: null } } }),
    prisma.lead.findMany({ where: { workspaceId: ctx.workspaceId, stage: "won" } }),
    prisma.appointment.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { startsAt: "desc" }, take: 20 }),
    prisma.crmActivity.findMany({ where: { workspaceId: ctx.workspaceId, type: { in: ["maya_reply", "stage_change"] } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const currency = workspace?.currency ?? "USD";
  const mayaWon = mayaLeads.filter((l) => l.stage === "won");
  const mayaPipelineValue = mayaLeads.reduce((s, l) => s + (l.estimatedValueCents ?? 0), 0);
  const mayaWonValue = mayaWon.reduce((s, l) => s + (l.estimatedValueCents ?? 0), 0);

  const funnel = [
    { label: "Maya conversations → leads", value: mayaLeads.length, hint: "captured conversations with commerce intent" },
    { label: "Leads → meetings", value: appts.length, hint: "appointments scheduled" },
    { label: "won deals", value: wonLeads.length, hint: `value ${formatMoney(wonLeads.reduce((s, l) => s + (l.estimatedValueCents ?? 0), 0), currency)}` },
    { label: "Maya-verified wins", value: mayaWon.length, hint: formatMoney(mayaWonValue, currency) },
  ];

  return (
    <PageShell title="Conversion Analytics" subtitle="How conversations become meetings become revenue - with unverified attribution labeled as such.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {funnel.map((f) => (
          <Card key={f.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</p>
            <p className="mt-1 text-3xl font-bold">{f.value}</p>
            <p className="mt-1 text-xs text-slate-500">{f.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Maya pipeline" dense>
          {mayaLeads.length === 0 ? (
            <EmptyState title="No Maya-sourced leads yet" body="As assistants chat with prospects, leads get linked here with a recorded provenance trail." action={{ label: "Open AI Maya", href: "/ai-maya" }} />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
              {mayaLeads.slice(0, 12).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{l.name}</p>
                    <p className="text-[11px] text-slate-400">{l.intent ?? "?"} · conversation {l.mayaConversationId?.slice(-6)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-slate-400">{l.estimatedValueCents ? formatMoney(l.estimatedValueCents, currency) : ""}</span>
                    <StatusBadge status={l.stage === "won" ? "approved" : "queued"} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Activity audit trail">
          {events.length === 0 ? (
            <p className="text-xs text-slate-400">Stage changes and Maya replies are logged as CRM activities for honest path-to-conversion review.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {events.map((e) => (
                <li key={e.id} className="truncate">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{e.type}</span>{" "}
                  <span className="text-slate-500 dark:text-slate-400">{e.content}</span>{" "}
                  <span className="text-slate-400">{formatDate(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Pipeline summary">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Open Maya-sourced pipeline: <strong>{formatMoney(mayaPipelineValue - mayaWonValue, currency)}</strong> · won: &nbsp;
          <strong>{formatMoney(mayaWonValue, currency)}</strong> — estimates are creator-entered and never presented as booked revenue.
        </p>
      </Card>
    </PageShell>
  );
}
