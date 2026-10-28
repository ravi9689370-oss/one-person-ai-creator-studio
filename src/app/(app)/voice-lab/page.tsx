import { VoiceCreateForm } from "@/components/forms/voice-create";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Voice Lab" };

export default async function VoiceLabPage() {
  const ctx = await pageCtx();
  const [scripts, profiles, jobs] = await Promise.all([
    prisma.script.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { versions: { orderBy: { version: "desc" }, take: 3, select: { id: true, version: true } } },
    }),
    prisma.voiceProfile.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" } }),
    prisma.voiceJob.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { scriptVersion: { include: { script: { select: { title: true } } } } },
    }),
  ]);
  const versionOptions = scripts.flatMap((s) =>
    s.versions.map((v) => ({ id: v.id, label: `${s.title} · v${v.version}` })),
  );
  const profileOptions = profiles.map((p) => ({ id: p.id, label: `${p.name} (${p.provider})` }));

  return (
    <PageShell title="Voice Lab" subtitle="Generate and manage narration takes. Jobs go through the agent pipeline; output audio is a real stored asset once verified.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`Voice jobs (${jobs.length})`} dense>
            {jobs.length === 0 ? (
              <EmptyState
                title="No voice jobs yet"
                body="Pick a script version on the right and generate your first take."
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {j.scriptVersion ? `${j.scriptVersion.script.title} · v${j.scriptVersion.version}` : "ad-hoc voice job"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {j.provider} · {j.language}{j.style ? ` · ${j.style}` : ""} · {formatDate(j.createdAt)}
                        {j.error ? ` · ${j.error}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {j.outputAssetId && (
                        <a href={`/api/media/${j.outputAssetId}/raw`} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-[#2c3560] dark:text-slate-200">
                          Play / download
                        </a>
                      )}
                      <StatusBadge status={j.status} isMock={/mock/.test(j.provider)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Voice profiles">
            {profiles.length === 0 ? (
              <p className="text-xs text-slate-400">
                No cloned profiles yet. When a real voice provider is configured, enrollment happens there; profiles then appear in this list.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {profiles.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{p.name}</span>
                    <span className="text-slate-400">{p.provider} · {p.language}{p.consentNote ? " · consented" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Generate voiceover">
          {versionOptions.length === 0 ? (
            <EmptyState title="No script versions yet" body="Create or approve a script first." action={{ label: "Open Scripts", href: "/scripts" }} />
          ) : (
            <VoiceCreateForm versions={versionOptions} profiles={profileOptions} />
          )}
          <p className="mt-2 text-[11px] text-slate-400">Jobs requiring review pause until approved - nothing auto-publishes.</p>
        </Card>
      </div>
    </PageShell>
  );
}
