import { ActionButtonOutline } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await pageCtx();
  const [schedules, reports] = await Promise.all([
    prisma.scheduledReport.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { kind: "asc" } }),
    prisma.report.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <PageShell title="Reports" subtitle="Scheduled digests and generated briefs. Morning brief compiles real workspace numbers - sparse-data sections are labeled, never padded with invented data.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Generated reports (${reports.length})`} dense>
            {reports.length === 0 ? (
              <EmptyState
                title="No reports yet"
                body="Run the morning brief now to generate today's digest from live data."
                action={{ label: "Morning brief", href: "/reports/morning-brief" }}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {r.kind} · {r.forDate} ({r.timezone})
                      </p>
                      <p className="text-[11px] text-slate-400">generated {formatDate(r.createdAt)}{r.isMock ? " · DEVELOPMENT FIXTURE" : ""}</p>
                    </div>
                    <StatusBadge status={r.status === "failed" ? "failed" : "approved"} isMock={r.isMock} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Schedules">
            {schedules.length === 0 ? (
              <p className="text-xs text-slate-400">No schedules. Onboarding creates the 07:00 morning brief by default.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {schedules.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{s.kind} @ {String(s.hourLocal).padStart(2, "0")}:{String(s.minuteLocal).padStart(2, "0")} {s.timezone}</span>
                    <span className="text-slate-400">{s.enabled ? "enabled" : "paused"} · channels {s.channels}· last run {formatDate(s.lastRunAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-slate-400">
              The scheduler process (<span className="font-mono">npm run scheduler</span>) fires these on time; <span className="font-mono">/api/cron/morning-brief</span> does it externally with the cron secret.
            </p>
          </Card>
        </div>
        <Card title="Actions">
          <div className="flex flex-col gap-2.5">
            <ActionButtonOutline endpoint="/api/reports/morning-brief" body={{}} label="Run brief for today" busyLabel="Compiling…" doneMessage="Brief generated (or re-used for today)." />
            <ActionButtonOutline
              endpoint="/api/reports/morning-brief"
              method="PATCH"
              body={{ enabled: true, channels: ["in_app"] }}
              label="Enable in-app briefings"
              doneMessage="Schedule updated."
            />
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
