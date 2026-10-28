import { ActionButton, ActionButtonOutline } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate, truncate } from "@/lib/utils";

export const metadata = { title: "Thumbnails" };

type ExperimentResults = { a?: { impressions: number; clicks: number }; b?: { impressions: number; clicks: number } };

function parseExperimentResults(raw: string | null): ExperimentResults | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExperimentResults;
  } catch {
    return null;
  }
}

export default async function ThumbnailsPage() {
  const ctx = await pageCtx();
  const [thumbs, experiments] = await Promise.all([
    prisma.thumbnail.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.thumbnailExperiment.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { startedAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <PageShell title="Thumbnails" subtitle="Concepts and A/B experiments. Results are recorded only from real measurements you enter or fetch.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Concepts (${thumbs.length})`} dense>
            {thumbs.length === 0 ? (
              <EmptyState title="No thumbnails yet" body="Generate concepts on the right - the Thumbnail Agent creates variants you can run experiments with." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {thumbs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{truncate(t.concept, 70)}</p>
                      {t.textOverlay && <p className="truncate text-xs text-slate-500 dark:text-slate-400">overlay: “{t.textOverlay}”</p>}
                      <p className="text-[11px] text-slate-400">{t.provider} · {formatDate(t.createdAt)}{t.variantGroup ? ` · variant ${t.variantGroup}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.assetId && (
                        <a href={`/api/media/${t.assetId}/raw`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 dark:border-[#2c3560] dark:text-slate-200">Preview</a>
                      )}
                      <StatusBadge status={t.status} isMock={/mock/.test(t.provider)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`A/B experiments (${experiments.length})`} dense>
            {experiments.length === 0 ? (
              <EmptyState title="No experiments running" body="Pick two variants to run an experiment - metrics come from real data only." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {experiments.map((e) => {
                  const results = parseExperimentResults(e.results);
                  const ctr = (v?: { impressions?: number; clicks?: number }) => (v && v.impressions ? ((v.clicks ?? 0) / v.impressions * 100).toFixed(1) + "%" : "—");
                  return (
                    <li key={e.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{e.name}</p>
                        <StatusBadge status={e.status} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        A: {ctr(results?.a)} · B: {ctr(results?.b)} · started {formatDate(e.startedAt)}{e.endedAt ? ` · ended ${formatDate(e.endedAt)}` : ""}
                      </p>
                      {e.status === "running" && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <ActionButtonOutline endpoint="/api/thumbnails/experiments" body={{ experimentId: e.id, action: "stop" }} label="Stop" />
                          <ActionButtonOutline endpoint="/api/thumbnails/experiments" body={{ experimentId: e.id, action: "conclude" }} label="Conclude" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Generate concepts">
            <ActionButton
              endpoint="/api/thumbnails"
              body={{ action: "concepts", title: "New concept batch" }}
              label="Generate 3 concepts"
              busyLabel="Agent working…"
              doneMessage="Concepts queued - refresh to see them."
            />
          </Card>
          <Card title="Start an experiment">
            {thumbs.length < 2 ? (
              <p className="text-xs text-slate-400">Generate at least two concepts first.</p>
            ) : (
              <ActionButtonOutline
                endpoint="/api/thumbnails"
                body={{ action: "experiment", variantAId: thumbs[0].id, variantBId: thumbs[1].id, name: `${new Date().toISOString().slice(0, 10)} A/B` }}
                label={`Test: ${thumbs[0].id.slice(-5)} vs ${thumbs[1].id.slice(-5)}`}
                doneMessage="Experiment started."
              />
            )}
            <p className="mt-2 text-[11px] text-slate-400">Records from the two newest concepts. Metrics are only counted from real recorded data.</p>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
