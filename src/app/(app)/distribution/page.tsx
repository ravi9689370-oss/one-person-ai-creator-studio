import Link from "next/link";
import { InlineForm } from "@/components/ui/inline-form";
import { ActionButtonOutline } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Distribution" };

export default async function DistributionPage() {
  const ctx = await pageCtx();
  const [accounts, campaigns, queueCounts] = await Promise.all([
    prisma.socialAccount.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { platform: "asc" } }),
    prisma.distributionCampaign.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.scheduledPost.groupBy({ by: ["status"], where: { workspaceId: ctx.workspaceId }, _count: { status: true } }),
  ]);
  const byStatus = Object.fromEntries(queueCounts.map((q) => [q.status, q._count.status]));

  return (
    <PageShell
      title="Distribution"
      subtitle="Publishing only happens through connected accounts with verified authorization - the platform never fakes a successful post."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/distribution/queue" className="card group block p-4 transition hover:shadow-pop">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Publishing queue</p>
          <p className="mt-1.5 text-3xl font-bold">{(byStatus.pending_approval ?? 0) + (byStatus.approved ?? 0) + (byStatus.queued ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-500">drafts &amp; scheduled posts awaiting their gates</p>
        </Link>
        <Link href="/distribution/posts" className="card group block p-4 transition hover:shadow-pop">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Published</p>
          <p className="mt-1.5 text-3xl font-bold">{byStatus.published ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">{byStatus.failed ?? 0} failed attempts recorded</p>
        </Link>
        <Link href="/distribution/accounts" className="card group block p-4 transition hover:shadow-pop">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Connected accounts</p>
          <p className="mt-1.5 text-3xl font-bold">{accounts.filter((a) => a.status === "connected").length}</p>
          <p className="mt-1 text-xs text-slate-500">of {accounts.length || 7} platforms</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Accounts" dense>
            {accounts.length === 0 ? (
              <EmptyState title="No accounts registered" body="Connect at least one platform before queueing posts." action={{ label: "Manage accounts", href: "/distribution/accounts" }} />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.platform}{a.handle ? ` · ${a.handle}` : ""}</p>
                      {a.lastError && <p className="text-[11px] text-rose-500">{a.lastError}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.status} />
                      <span className="text-[11px] text-slate-400">verified {formatRelative(a.lastVerifiedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Queue a post">
          <InlineForm
            endpoint="/api/distribution"
            submitLabel="Create draft post"
            successMessage="Draft created - approve it before publishing."
            fields={[
              { name: "platform", label: "Platform", type: "select", options: [
                { value: "youtube", label: "YouTube" }, { value: "tiktok", label: "TikTok" },
                { value: "instagram", label: "Instagram" }, { value: "facebook", label: "Facebook" },
                { value: "linkedin", label: "LinkedIn" }, { value: "substack", label: "Substack" },
                { value: "spotify", label: "Spotify" },
              ] },
              { name: "title", label: "Title", required: true },
              { name: "caption", label: "Caption", type: "textarea", min: 3 },
              { name: "hashtags", label: "Hashtags", placeholder: "a, b, c" },
            ]}
          />
          <p className="mt-2 text-[11px] text-slate-400">
            Posts start as drafts, then require approval, and the publish step verifies the account connection first.
          </p>
        </Card>
      </div>

      <Card title="Campaigns">
        {campaigns.length === 0 ? (
          <p className="text-xs text-slate-400">No campaigns yet - they group scheduled posts.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.name}</p>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
