import { InlineForm } from "@/components/ui/inline-form";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Brand Deals" };

export default async function BrandDealsPage() {
  const ctx = await pageCtx();
  const [workspace, deals, sponsors] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } }),
    prisma.product.findMany({ where: { workspaceId: ctx.workspaceId, kind: "brand_deal" }, orderBy: { createdAt: "desc" } }),
    prisma.lead.findMany({ where: { workspaceId: ctx.workspaceId, intent: { contains: "brand" } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const currency = workspace?.currency ?? "USD";

  return (
    <PageShell title="Brand Deals" subtitle="Offerings, sponsorship pipeline, and deal terms - one place for the business side of the studio.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Deal offerings" dense>
            {deals.length === 0 ? (
              <EmptyState title="No brand-deal products yet" body="Create a brand_deal product below (e.g. a $25,000 affiliate package) and attach sponsors when they arrive." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.name}</p>
                      {d.description && <p className="text-xs text-slate-500 dark:text-slate-400">{d.description}</p>}
                      <p className="text-[11px] text-slate-400">product id: <span className="font-mono">{d.id}</span></p>
                    </div>
                    <span className="shrink-0 text-sm font-bold">{formatMoney(d.priceCents, d.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Sponsor pipeline">
            {sponsors.length === 0 ? (
              <p className="text-xs text-slate-400">No sponsor-intent leads. AI Maya tags intent=brand_deal when a sponsor inquires.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {sponsors.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{s.name}</span>
                    <StatusBadge status={s.stage === "won" ? "approved" : s.stage} />
                    {s.notes && <span className="hidden truncate text-slate-400 sm:block">{s.notes}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Create deal offering">
          <InlineForm
            endpoint="/api/monetization"
            submitLabel="Create brand-deal product"
            successMessage="Deal offering created."
            extra={{ type: "product" }}
            fields={[
              { name: "name", label: "Name", required: true, placeholder: "e.g. Affiliate integration package" },
              { name: "kind", label: "Kind", type: "select", defaultValue: "brand_deal", options: [{ value: "brand_deal", label: "Brand deal" }] },
              { name: "priceCents", label: "Price (cents)", type: "number", min: 0, defaultValue: "2500000" },
              { name: "description", label: "Description", type: "textarea", min: 3 },
            ]}
          />
          <p className="mt-2 text-[11px] text-slate-400">Reference deals get added to sponsor-read scripts via the sponsor fields.</p>
        </Card>
      </div>
      <Card title="Deal calendar">
        <p className="text-xs text-slate-400">Scheduled sponsor reads appear here - the first batch ships once scripts carry a sponsorName. Updated {formatDate(new Date())}.</p>
      </Card>
    </PageShell>
  );
}
