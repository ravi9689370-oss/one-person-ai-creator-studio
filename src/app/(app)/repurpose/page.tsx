import { ActionButton, ActionButtonOutline } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Repurposing" };

export default async function RepurposePage() {
  const ctx = await pageCtx();
  const [jobs, sourceVideos] = await Promise.all([
    prisma.repurposeJob.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { clips: { orderBy: { startSec: "asc" }, take: 12 } },
    }),
    prisma.mediaAsset.findMany({ where: { workspaceId: ctx.workspaceId, kind: "video" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true } }),
  ]);

  return (
    <PageShell title="Repurposing" subtitle="Turn long-form videos into short clips. Candidate clips must be verified as real playable assets before they count as ready.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {jobs.length === 0 ? (
            <Card><EmptyState title="No repurpose jobs yet" body="Upload a source video to the Media Library, then queue clip extraction on the right." action={{ label: "Media Library", href: "/workspace/media-library" }} /></Card>
          ) : (
            jobs.map((j) => (
              <Card key={j.id} title={`Job ${j.id.slice(-6)} · target ${j.targetClips} clips × ${j.targetDurationSec}s`} actions={<StatusBadge status={j.status} isMock={/mock/.test(j.provider)} />}>
                <p className="text-[11px] text-slate-400">source: {j.sourceAssetId} · {formatDate(j.createdAt)}{j.error ? ` · ${j.error}` : ""}</p>
                {j.clips.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {j.clips.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-[#232b4d]">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-800 dark:text-slate-100">{c.title}</p>
                          <p className="text-[11px] text-slate-400">{c.startSec}s–{c.endSec}s · {c.aspect}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {c.assetId && <a href={`/api/media/${c.assetId}/raw`} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 dark:border-[#2c3560] dark:text-slate-200">Play</a>}
                          {c.status === "ready" && (
                            <ActionButtonOutline endpoint="/api/repurpose" method="PATCH" body={{ clipId: c.id, status: "verified" }} label="Verify" doneMessage="Verified." />
                          )}
                          {c.status === "candidate" && (
                            <ActionButtonOutline endpoint="/api/repurpose" method="PATCH" body={{ clipId: c.id, status: "rejected" }} label="Reject" className="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300" />
                          )}
                          <StatusBadge status={c.status} isMock={false} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">No clips extracted yet.</p>
                )}
              </Card>
            ))
          )}
        </div>
        <Card title="Queue clip extraction">
          {sourceVideos.length === 0 ? (
            <EmptyState title="No source video" body="Upload a long-form video in the Media Library first." action={{ label: "Media Library", href: "/workspace/media-library" }} />
          ) : (
            <ActionButton
              endpoint="/api/repurpose"
              body={{ sourceAssetId: sourceVideos[0].id, targetClips: 6, targetDurationSec: 45 }}
              label={`Extract from ${sourceVideos[0].title.slice(0, 18)}…`}
              busyLabel="Agent working…"
              doneMessage="Repurpose job queued."
            />
          )}
          <p className="mt-2 text-[11px] text-slate-400">Runs on the newest video. In fixture mode, proposed cuts are candidates until a real render exists.</p>
        </Card>
      </div>
    </PageShell>
  );
}
