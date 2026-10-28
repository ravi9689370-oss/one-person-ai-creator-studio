import { ActionButton, ActionButtonOutline } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate, truncate } from "@/lib/utils";

export const metadata = { title: "Publishing Queue" };

export default async function QueuePage() {
  const ctx = await pageCtx();
  const posts = await prisma.scheduledPost.findMany({
    where: { workspaceId: ctx.workspaceId, status: { notIn: ["published", "cancelled"] } },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    take: 40,
  });
  const connected = new Set(
    (await prisma.socialAccount.findMany({ where: { workspaceId: ctx.workspaceId, status: "connected" }, select: { platform: true } })).map((a) => a.platform),
  );

  return (
    <PageShell title="Publishing Queue" subtitle="Draft → approval → publish. The attempt button fails closed and records the failure reason when a platform isn't actually connected." >
      <Card dense>
        {posts.length === 0 ? (
          <EmptyState title="Queue is empty" body="Create a draft post from the Distribution overview." action={{ label: "Open Distribution", href: "/distribution" }} />
        ) : (
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-[#232b4d]">
                <th className="px-4 py-2.5 text-left font-semibold">Post</th>
                <th className="px-4 py-2.5 text-left font-semibold">Platform</th>
                <th className="px-4 py-2.5 text-left font-semibold">Scheduled</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1d254d]">
              {posts.map((p) => {
                const connectedNow = connected.has(p.platform);
                return (
                  <tr key={p.id} className="align-middle">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{truncate(p.title, 60)}</p>
                      {p.caption && <p className="truncate text-xs text-slate-500">{p.caption}</p>}
                      {p.failureReason && <p className="mt-0.5 text-[11px] text-rose-500">fail: {p.failureReason}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm">{p.platform}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.scheduledFor)}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.status === "draft" && (
                          <ActionButtonOutline endpoint={`/api/distribution/${p.id}`} body={{ action: "request_approval" }} label="Request approval" doneMessage="Approval requested." />
                        )}
                        {p.status === "approved" || p.status === "queued" ? (
                          <ActionButton
                            endpoint={`/api/distribution/${p.id}`}
                            body={{ action: "attempt_publish" }}
                            label={connectedNow ? "Attempt publish" : "Attempt (will fail)"}
                            busyLabel="Attempting…"
                            doneMessage={connectedNow ? "Publish attempted." : "Attempted - platform not connected (recorded as failed)."}
                          />
                        ) : null}
                        {p.status !== "published" && p.status !== "cancelled" && (
                          <ActionButtonOutline
                            endpoint={`/api/distribution/${p.id}`}
                            body={{ action: "cancel" }}
                            label="Cancel"
                            className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                          />
                        )}
                        {p.status === "pending_approval" && <span className="text-[11px] text-slate-400">waiting for your review</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </PageShell>
  );
}
