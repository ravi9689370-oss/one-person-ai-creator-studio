import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Published Posts" };

export default async function PostsPage() {
  const ctx = await pageCtx();
  const [posts, metrics] = await Promise.all([
    prisma.publishedPost.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { publishedAt: "desc" }, take: 50 }),
    prisma.postMetric.findMany({ orderBy: { capturedAt: "desc" }, take: 100 }),
  ]);
  const metricBy = new Map<string, (typeof metrics)[number]>();
  for (const m of metrics) if (!metricBy.has(m.publishedPostId)) metricBy.set(m.publishedPostId, m);
  const failed = await prisma.scheduledPost.count({ where: { workspaceId: ctx.workspaceId, status: "failed" } });

  return (
    <PageShell title="Published Posts" subtitle="Only verified publishing events appear here, with the provenance of any metrics." >
      <Card dense>
        {posts.length === 0 ? (
          <EmptyState
            title="No published posts recorded"
            body={failed > 0
              ? `${failed} publish attempt${failed > 1 ? "s" : ""} failed (platform not connected) - nothing was fabricated. Connect an account and attempt again.`
              : "Once a connected platform receives a post, it is recorded here."}
            action={{ label: "Open distribution", href: "/distribution" }}
          />
        ) : (
          <DataTable
            rows={posts}
            columns={[
              { header: "Platform", render: (p) => <span className="font-semibold">{p.platform}</span> },
              { header: "Published", render: (p) => <span className="text-xs">{formatDate(p.publishedAt)}</span> },
              { header: "URL", render: (p) => p.url ? <a href={p.url} className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400" onClick={(e) => e.stopPropagation()}>open →</a> : <span className="text-xs text-slate-400">manual</span>, hideOnMobile: true },
              { header: "External ID", render: (p) => <span className="font-mono text-[11px]">{p.externalId || "—"}</span>, hideOnMobile: true },
              { header: "Views", render: (p) => { const m = metricBy.get(p.id); return <span className="text-xs">{m?.views ?? "—"}</span>; } },
              { header: "Metrics source", render: (p) => { const m = metricBy.get(p.id); return <span className="text-[11px] text-slate-400">{m?.source ?? p.metricsSource}</span>; } },
            ]}
          />
        )}
      </Card>
    </PageShell>
  );
}
