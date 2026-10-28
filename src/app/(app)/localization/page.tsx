import { ActionButtonOutline } from "@/components/forms/action-button";
import { LocalizationCreateForm } from "@/components/forms/localization-create";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate, truncate } from "@/lib/utils";

export const metadata = { title: "Localization" };

export default async function LocalizationPage() {
  const ctx = await pageCtx();
  const [projects, scripts, assets] = await Promise.all([
    prisma.localizationProject.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { variants: { orderBy: { language: "asc" } } },
    }),
    prisma.script.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true } }),
    prisma.mediaAsset.findMany({ where: { workspaceId: ctx.workspaceId, kind: { in: ["audio", "video"] } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true } }),
  ]);

  return (
    <PageShell title="Localization" subtitle="Translate, review, and dub into other languages. Translations pass through human approval and the dub step is provider-gated.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {projects.length === 0 ? (
            <Card><EmptyState title="No localization projects" body="Create one on the right - pick a source script or media asset and target languages." /></Card>
          ) : (
            projects.map((p) => (
              <Card key={p.id} title={`${p.name} · ${p.sourceLanguage} → ${p.playbackType}`} actions={<StatusBadge status={p.status} />}>
                <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                  {p.variants.map((v) => (
                    <li key={v.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{v.language}</p>
                        {v.translatedText && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{truncate(v.translatedText, 140)}</p>}
                        {v.reviewNotes && <p className="text-[11px] text-slate-400">note: {v.reviewNotes}</p>}
                        <p className="text-[11px] text-slate-400">updated {formatDate(v.updatedAt)}{v.lipSyncAvailable ? "" : " · lip-sync unavailable (provider)"}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <StatusBadge status={v.status === "failed" ? "failed" : v.status} />
                        {v.status === "queued" && (
                          <>
                            <ActionButtonOutline endpoint={`/api/localization/${p.id}`} body={{ action: "translate", language: v.language }} label="Translate" busyLabel="Translating…" doneMessage="Translation queued." />
                          </>
                        )}
                        {v.status === "translated" && (
                          <>
                            <ActionButtonOutline endpoint={`/api/localization/${p.id}`} body={{ action: "approve", language: v.language }} label="Approve" doneMessage="Approved." />
                            <ActionButtonOutline endpoint={`/api/localization/${p.id}`} body={{ action: "reject", language: v.language, note: "needs adjustments" }} label="Reject" className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300" />
                          </>
                        )}
                        {v.status === "approved" && (
                          <ActionButtonOutline endpoint={`/api/localization/${p.id}`} body={{ action: "dub", language: v.language }} label="Dub" busyLabel="Dubbing…" doneMessage="Dub job queued." />
                        )}
                        {v.subtitleAssetId && (
                          <a href={`/api/media/${v.subtitleAssetId}/raw`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-[#2c3560] dark:text-slate-200">SRT</a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          )}
        </div>
        <Card title="New project">
          <LocalizationCreateForm
            scripts={scripts.map((s) => ({ id: s.id, label: s.title }))}
            assets={assets.map((a) => ({ id: a.id, label: a.title }))}
          />
        </Card>
      </div>
    </PageShell>
  );
}
