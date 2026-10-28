import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButtonOutline, ActionButton } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate, truncate } from "@/lib/utils";

export const metadata = { title: "Script Detail" };

export default async function ScriptDetailPage({ params }: { params: { id: string } }) {
  const ctx = await pageCtx();
  const script = await prisma.script.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    include: {
      versions: { orderBy: { version: "desc" } },
      topic: { select: { id: true, title: true } },
    },
  });
  if (!script) notFound();
  const current = script.versions.find((v) => v.version === script.currentVersion) ?? script.versions[0];

  return (
    <PageShell
      title={script.title}
      subtitle={`${script.format} · ${script.platform} · ${script.language}${script.topic ? ` · topic: ${script.topic.title}` : ""}`}
      actions={<Link href="/scripts" className="btn-outline">All scripts</Link>}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Current version (v${script.currentVersion})`} actions={<StatusBadge status={script.status} />}>
            <pre className="max-h-[480px] overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{current?.body || "(empty)"}</pre>
            {current?.tone && <p className="mt-2 text-[11px] text-slate-400">tone: {current.tone} · target {current.targetMin ?? "?"} min</p>}
          </Card>
          <Card title={`Version history (${script.versions.length})`} dense>
            <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
              {script.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    v{v.version} {v.changeNote ? <span className="text-xs text-slate-400">· {truncate(v.changeNote, 60)}</span> : null}
                  </p>
                  <span className="text-xs text-slate-400">{formatDate(v.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Script actions">
            <div className="flex flex-col gap-2.5">
              {script.status === "pending_approval" ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  Awaiting your approval in the Approvals queue - publishing and production unlock only after it is approved.
                </p>
              ) : (
                <ActionButtonOutline endpoint={`/api/scripts/${script.id}/generate`} body={{ scriptId: script.id }} label="Send for approval" doneMessage="Submitted for approval." />
              )}
              <ActionButton
                endpoint={`/api/scripts/${script.id}/generate`}
                method="PUT"
                body={{ scriptId: script.id, direction: "Improve: sharpen the hook, tighten pacing, keep the brand voice." }}
                label="AI revision pass"
                busyLabel="Running agent…"
                doneMessage="Revision task queued."
                className="border border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-[#2c3560] dark:bg-[#16204a] dark:text-slate-200"
              />
              {script.status !== "approved" && script.status !== "archived" ? (
                <ActionButton
                  endpoint={`/api/scripts/${script.id}`}
                  method="PATCH"
                  body={{ status: "archived" }}
                  label="Archive"
                  confirmText="Archive this script?"
                  className="border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                />
              ) : null}
            </div>
          </Card>
          <Card title="Sponsorship">
            {script.sponsorName ? (
              <>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{script.sponsorName}</p>
                {script.sponsorTerms && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{script.sponsorTerms}</p>}
              </>
            ) : (
              <p className="text-xs text-slate-400">No sponsor attached.</p>
            )}
          </Card>
          <Card title="Next step">
            <Link href="/voice-lab" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400">Generate a voiceover →</Link>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
