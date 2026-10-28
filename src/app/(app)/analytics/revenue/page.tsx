import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Revenue Analytics" };

export default async function RevenueAnalyticsPage() {
  const ctx = await pageCtx();
  const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } });
  const currency = workspace?.currency ?? "USD";
  const [records, paidOrders] = await Promise.all([
    prisma.revenueRecord.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { occurredAt: "desc" }, take: 40 }),
    prisma.order.findMany({
      where: { workspaceId: ctx.workspaceId, status: "paid", verifiedByIdEvent: { not: null } },
      orderBy: { verifiedAt: "desc" },
      take: 20,
    }),
  ]);

  const bySource = new Map<string, number>();
  for (const r of records.filter((r) => r.kind === "sale")) bySource.set(r.source, (bySource.get(r.source) ?? 0) + r.amountCents);
  const total = Array.from(bySource.values()).reduce((a, b) => a + b, 0);

  return (
    <PageShell title="Revenue Analytics" subtitle="Sale records with provenance: provider-verified orders versus subscriptions versus manual.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><p className="font-semibold uppercase tracking-wide text-[11px] text-slate-400">Total recorded</p><p className="mt-1 text-3xl font-bold">{formatMoney(total, currency)}</p></Card>
        <Card><p className="font-semibold uppercase tracking-wide text-[11px] text-slate-400">Sale records</p><p className="mt-1 text-3xl font-bold">{records.filter((r) => r.kind === "sale").length}</p></Card>
        <Card><p className="font-semibold uppercase tracking-wide text-[11px] text-slate-400">Provider-verified orders</p><p className="mt-1 text-3xl font-bold">{paidOrders.length}</p></Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="By source">
          {bySource.size === 0 ? (
            <p className="text-xs text-slate-400">No revenue recorded yet. Manual sales appear here with their unverified label.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {Array.from(bySource.entries()).map(([source, cents]) => (
                <li key={source} className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{source}</span>
                  <span>{formatMoney(cents, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Provider-verified orders" dense>
          {paidOrders.length === 0 ? (
            <EmptyState title="No verified orders" body="Orders become verified when a signed provider payment event (e.g. Stripe webhook) references them." />
          ) : (
            <DataTable
              rows={paidOrders}
              columns={[
                { header: "Order", render: (o) => <span className="font-mono text-[11px]">{o.id.slice(-8)}</span> },
                { header: "Amount", render: (o) => formatMoney(o.amountCents, o.currency) },
                { header: "Verified", render: (o) => <StatusBadge status="verified" /> },
                { header: "At", render: (o) => <span className="text-xs text-slate-400">{formatDate(o.verifiedAt)}</span> },
              ]}
            />
          )}
        </Card>
      </div>

      <Card title="Revenue ledger" dense>
        {records.length === 0 ? (
          <p className="p-2 text-xs text-slate-400">Empty - entries appear when orders settle or you record manual sales.</p>
        ) : (
          <DataTable
            rows={records}
            columns={[
              { header: "When", render: (r) => <span className="text-xs">{formatDate(r.occurredAt)}</span> },
              { header: "Kind", render: (r) => <StatusBadge status={r.kind === "sale" ? "approved" : r.kind === "refund" ? "failed" : "queued"} /> },
              { header: "Source", render: (r) => <span className="text-xs">{r.source}</span> },
              { header: "Label", render: (r) => <span className="text-xs text-slate-500">{r.label ?? "—"}</span>, hideOnMobile: true },
              { header: "Amount", render: (r) => <span className={r.kind === "refund" ? "text-rose-600" : "font-semibold"}>{r.kind === "refund" ? "-" : ""}{formatMoney(r.amountCents, r.currency)}</span> },
            ]}
          />
        )}
      </Card>
    </PageShell>
  );
}
