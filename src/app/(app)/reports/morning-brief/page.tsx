import { notFound } from "next/navigation";
import { ActionButtonOutline } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Morning Brief" };

type BriefSection = { heading: string; lines: string[]; dataQuality: "real" | "partial" | "none" };
type BriefContent = { generatedAtLocal?: string; sections: BriefSection[] };

const DQ_LABEL: Record<string, string> = {
  real: "REAL DATA",
  partial: "PARTIAL DATA",
  none: "NO DATA",
};
const DQ_CLASS: Record<string, string> = {
  real: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  partial: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  none: "bg-slate-100 text-slate-500 dark:bg-[#1a2148] dark:text-slate-400",
};

export default async function MorningBriefPage({ searchParams }: { searchParams: { for?: string } }) {
  const ctx = await pageCtx();
  const forDate = searchParams.for;
  const reports = await prisma.report.findMany({
    where: { workspaceId: ctx.workspaceId, kind: "morning_brief" },
    orderBy: { createdAt: "desc" },
    take: 14,
  });
  const current = forDate ? reports.find((r) => r.forDate === forDate) : reports[0];
  if (!current) {
    return (
      <PageShell title="Morning Brief" subtitle="Executive digest generated each morning from live workspace data.">
        <Card title="Not generated yet">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No brief has been generated so far. &ldquo;Run now&rdquo; compiles today&apos;s brief from real numbers; until scheduled deliveries run, data stays sparse and the sections say so.
          </p>
          <div className="mt-3">
            <ActionButtonOutline endpoint="/api/reports/morning-brief" body={{}} label="Run now" busyLabel="Compiling…" doneMessage="Brief generated." />
          </div>
        </Card>
      </PageShell>
    );
  }

  let content: BriefContent | null = null;
  try { content = JSON.parse(current.content) as BriefContent; } catch { content = null; }

  return (
    <PageShell
      title={`Morning Brief · ${current.forDate}`}
      subtitle={`${current.timezone}${content?.generatedAtLocal ? ` · generated ${content.generatedAtLocal}` : ""} · generated ${formatDate(current.createdAt)}`}
      actions={
        <>
          <ActionButtonOutline endpoint="/api/reports/morning-brief" body={{}} label="Run today" busyLabel="Compiling…" doneMessage="Done." />
        </>
      }
    >
      {current.isMock && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          DEVELOPMENT FIXTURE — generated in dev mode; external delivery channels (email/Slack) are not configured. In-app generation of real data still applies.
        </div>
      )}
      <div className="space-y-4">
        {reports.length > 1 && (
          <Card title="Previous briefs" dense>
            <div className="flex flex-wrap gap-1.5 px-0 py-1">
              {reports.slice(0, 14).map((r) => (
                <a key={r.id} href={`/reports/morning-brief?for=${r.forDate}`} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.id === current.id ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600 dark:border-[#2c3560] dark:text-slate-300"}`}>
                  {r.forDate}
                </a>
              ))}
            </div>
          </Card>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(content?.sections ?? []).map((s) => (
            <Card key={s.heading} title={s.heading} actions={<span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${DQ_CLASS[s.dataQuality] ?? DQ_CLASS.partial}`}>{DQ_LABEL[s.dataQuality] ?? DQ_LABEL.partial}</span>}>
              <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                {s.lines.map((line, i) => <li key={i}>• {line}</li>)}
                {s.lines.length === 0 && <li className="text-xs text-slate-400">No data for this section.</li>}
              </ul>
            </Card>
          ))}
          {!content && <Card title="Unreadable report"><p className="text-xs text-rose-600">The stored report content could not be parsed.</p></Card>}
        </div>
        <Card title="Provenance">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Data quality badges reflect what the generator found: <span className="font-bold">REAL</span> = counted from workspace records, <span className="font-bold">PARTIAL</span> = some records exist, <span className="font-bold">NO DATA</span> = nothing to report (never fabricated).
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
