import { InlineForm } from "@/components/ui/inline-form";
import { ActionButtonOutline } from "@/components/forms/action-button";
import { ManualSaleForm } from "@/components/forms/manual-sale";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Monetization" };

export default async function MonetizationPage() {
  const ctx = await pageCtx();
  const [products, orders, events, workspace] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.order.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.paymentEvent.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { receivedAt: "desc" }, take: 12 }),
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } }),
  ]);
  const currency = workspace?.currency ?? "USD";
  const paid = orders.filter((o) => o.status === "paid");
  const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "awaiting_payment");

  return (
    <PageShell
      title="Monetization"
      subtitle="Products and orders. A sale only counts as revenue when it was verified by a signed provider payment event - manual records must be acknowledged as unverified."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Paid orders</p><p className="mt-1 text-3xl font-bold">{paid.length}</p><p className="text-xs text-slate-500">{formatMoney(paid.reduce((s, o) => s + o.amountCents, 0), currency)} verified</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Awaiting payment</p><p className="mt-1 text-3xl font-bold">{pendingOrders.length}</p><p className="text-xs text-slate-500">not counted until verified</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Provider events</p><p className="mt-1 text-3xl font-bold">{events.filter((e) => e.signatureVerified).length}</p><p className="text-xs text-slate-500">signature-verified webhook events</p></Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Products (${products.length})`} dense>
            {products.length === 0 ? (
              <EmptyState title="No products yet" body="Create your first offering on the right - Maya recommends it and orders reference it." />
            ) : (
              <DataTable
                rows={products}
                columns={[
                  { header: "Name", render: (p) => <span className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</span> },
                  { header: "Kind", render: (p) => <span className="text-xs">{p.kind}</span> },
                  { header: "Price", render: (p) => <span className="text-sm font-semibold">{formatMoney(p.priceCents, p.currency)}</span> },
                  { header: "State", render: (p) => <StatusBadge status={p.active ? "approved" : "queued"} /> },
                ]}
              />
            )}
          </Card>
          <Card title={`Orders (${orders.length})`} dense>
            {orders.length === 0 ? (
              <EmptyState title="No orders" body="Sales synced from a real payment provider or manual entries (acknowledged unverified) land here." />
            ) : (
              <DataTable
                rows={orders}
                columns={[
                  { header: "Order", render: (o) => <span className="font-mono text-[11px]">{o.id.slice(-8)}</span> },
                  { header: "Product", render: (o) => <span className="text-xs">{products.find((p) => p.id === o.productId)?.name ?? o.productId.slice(-6)}</span> },
                  { header: "Amount", render: (o) => <span className="text-sm font-semibold">{formatMoney(o.amountCents, o.currency)}</span> },
                  { header: "Status", render: (o) => <StatusBadge status={o.status} /> },
                  { header: "Verified by", render: (o) => <span className="text-[10px] text-slate-400">{o.verifiedByIdEvent ? `event ${o.verifiedByIdEvent.slice(-6)}` : o.provider === "stripe" ? "awaiting webhook" : "manual"}</span> },
                  { header: "Actions", render: (o) => o.status !== "paid" ? <ActionButtonOutline endpoint="/api/monetization" body={{ type: "verify_order", orderId: o.id, acknowledge: true }} label="Attempt verify" doneMessage="Verify attempted - needs a signed provider event." /> : null },
                ]}
              />
            )}
          </Card>
          <Card title="Provider payment events (webhook ledger)">
            {events.length === 0 ? (
              <p className="text-xs text-slate-400">
                configure STRIPE_WEBHOOK_SECRET (see Integrations) and signed `payment_intent.succeeded` events will appear here, HMAC-verified.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs dark:divide-[#232b4d]">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="font-mono">{e.provider} · {e.type}</span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={e.signatureVerified ? "verified" : "failed"} />
                      <span className="text-slate-400">{formatDate(e.receivedAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="New product">
            <InlineForm
              endpoint="/api/monetization"
              submitLabel="Create product"
              successMessage="Product created."
              extra={{ type: "product" }}
              fields={[
                { name: "name", label: "Name", required: true },
                { name: "kind", label: "Kind", type: "select", options: [
                  { value: "course", label: "Course" },
                  { value: "coaching", label: "Coaching" },
                  { value: "brand_deal", label: "Brand deal" },
                  { value: "subscription", label: "Subscription" },
                ] },
                { name: "priceCents", label: "Price (cents)", type: "number", required: true, min: 0 },
                { name: "description", label: "Description", type: "textarea", min: 3 },
              ]}
            />
          </Card>
          <Card title="Record a manual sale">
            <ManualSaleForm products={products.map((p) => ({ id: p.id, label: `${p.name} · ${formatMoney(p.priceCents, p.currency)}` }))} />
            <p className="mt-2 text-[11px] text-slate-400">
              Manual sales never count as provider-verified revenue: records enter as unverified and are clearly labeled until a signed payment event ties them to reality.
            </p>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
