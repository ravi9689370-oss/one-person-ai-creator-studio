import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Voice Notes" };

export default async function VoiceNotesPage() {
  const ctx = await pageCtx();
  const assets = await prisma.mediaAsset.findMany({ where: { workspaceId: ctx.workspaceId, kind: "audio" }, orderBy: { createdAt: "desc" }, take: 40 });
  const transcriptions = await prisma.transcriptionJob.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 40 });

  return (
    <PageShell title="Voice Notes" subtitle="Ideas spoken out loud. Transcriptions become searchable knowledge and script seeds.">
      <Card title={`Audio notes (${assets.length})`} dense>
        {assets.length === 0 ? (
          <EmptyState
            title="No voice notes yet"
            body="Record yourself thinking out loud, upload the audio here, then let the transcription agent turn it into text notes."
            action={{ label: "Upload in Media Library", href: "/workspace/media-library" }}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
            {assets.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatDate(a.createdAt)}
                      {a.durationSec ? ` · ${Math.round(a.durationSec)}s` : ""}
                      {a.language ? ` · ${a.language}` : ""}
                    </p>
                  </div>
                  <a href={`/api/media/${a.id}/raw`} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-[#2c3560] dark:bg-[#16204a] dark:text-slate-200">Download</a>
                </div>
                {transcriptions.some((t) => t.sourceAssetId === a.id) ? (
                  (function () {
                    const job = transcriptions.find((t) => t.sourceAssetId === a.id);
                    return (
                      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-[#232b4d] dark:bg-[#111633]">
                        <StatusBadge status={job?.status ?? "queued"} isMock={/mock/.test(job?.provider ?? "")} />
                        {job?.text && <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{job.text.slice(0, 500)}</p>}
                      </div>
                    );
                  })()
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">Not transcribed yet.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
