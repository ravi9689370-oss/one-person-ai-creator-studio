import { VideoCreateForm } from "@/components/forms/video-create";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Video Studio" };

export default async function VideoStudioPage() {
  const ctx = await pageCtx();
  const [scripts, voiceJobs, broll, videoJobs] = await Promise.all([
    prisma.script.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { versions: { orderBy: { version: "desc" }, take: 3, select: { id: true, version: true } } },
    }),
    prisma.voiceJob.findMany({
      where: { workspaceId: ctx.workspaceId, outputAssetId: { not: null }, status: "succeeded" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { scriptVersion: { include: { script: { select: { title: true } } } } },
    }),
    prisma.mediaAsset.findMany({ where: { workspaceId: ctx.workspaceId, kind: "video" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true } }),
    prisma.videoJob.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return (
    <PageShell title="Video Studio" subtitle="Assemble drafts into captioned renders. Rendering stays honest: until a real render provider is connected, jobs fail visibly instead of faking an MP4.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`Video jobs (${videoJobs.length})`} dense>
            {videoJobs.length === 0 ? (
              <EmptyState
                title="No video jobs yet"
                body="Queue your first render with a script version on the right."
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {videoJobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{j.aspect} render</p>
                      <p className="text-[11px] text-slate-400">
                        {j.provider} · {formatDate(j.createdAt)}{j.error ? ` · ${j.error}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {j.outputAssetId && (
                        <a href={`/api/media/${j.outputAssetId}/raw`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-[#2c3560] dark:text-slate-200">
                          Watch
                        </a>
                      )}
                      {j.captionAssetId && (
                        <a href={`/api/media/${j.captionAssetId}/raw`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-[#2c3560] dark:text-slate-200">Captions</a>
                      )}
                      <StatusBadge status={j.status} isMock={/mock/.test(j.provider)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Honesty notice">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              In development-fixture mode the mock renderer intentionally cannot produce a real MP4 - such jobs fail with a clear reason rather than fabricating a file. Connect a real provider (or upload your own assets) to complete renders.
            </p>
          </Card>
        </div>
        <Card title="Queue render">
          <VideoCreateForm
            versions={scripts.flatMap((s) => s.versions.map((v) => ({ id: v.id, label: `${s.title} · v${v.version}` })))}
            voices={voiceJobs
              .filter((j) => j.scriptVersion)
              .map((j) => ({ id: j.outputAssetId ?? j.id, jobId: j.id, label: `${j.scriptVersion?.script.title ?? "voice"} · ${formatDate(j.createdAt)}` }))}
            brollAssets={broll.map((a) => ({ id: a.id, label: a.title }))}
          />
        </Card>
      </div>
    </PageShell>
  );
}
