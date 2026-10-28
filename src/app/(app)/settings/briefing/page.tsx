import { InlineForm } from "@/components/ui/inline-form";
import { ActionButtonOutline } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";

export const metadata = { title: "Briefing Settings" };

export default async function BriefingSettingsPage() {
  const ctx = await pageCtx();
  const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { timezone: true } });
  const schedule = await prisma.scheduledReport.findUnique({
    where: { workspaceId_kind: { workspaceId: ctx.workspaceId, kind: "morning_brief" } },
  });
  const tz = schedule?.timezone ?? workspace?.timezone ?? "UTC";
  const channels = (() => {
    try { return JSON.parse(schedule?.channels ?? '["in_app"]') as string[]; } catch { return ["in_app"]; }
  })();

  return (
    <PageShell title="Briefing" subtitle="When and how your morning brief arrives. Delivery channels activate once a provider is configured; in-app always works.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Schedule">
          <InlineForm
            endpoint="/api/reports/morning-brief"
            method="PATCH"
            submitLabel="Save schedule"
            successMessage="Schedule saved."
            fields={[
              { name: "hourLocal", label: "Hour (24h)", type: "number", defaultValue: String(schedule?.hourLocal ?? 7), resetAfter: false },
              { name: "minuteLocal", label: "Minute", type: "number", defaultValue: String(schedule?.minuteLocal ?? 0), resetAfter: false },
              { name: "timezone", label: "Timezone (IANA)", defaultValue: tz, resetAfter: false, required: true },
            ]}
          >
            <div className="flex flex-wrap gap-2">
              {(["in_app", "email", "slack"] as const).map((c) => (
                <span key={c} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${channels.includes(c) ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-500 dark:border-[#2c3560]"}`}>
                  {c}{c === "in_app" ? " (always)" : ""}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Note: channels are managed via the API (PATCH with a channels array). Email/Slack delivery needs provider configuration in Integrations - the schedule is saved locally regardless and marks external delivery honestly.
            </p>
          </InlineForm>
        </Card>
        <Card title="Status & actions">
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li>Enabled: <strong>{schedule?.enabled ? "yes" : "no"}</strong></li>
            <li>Last run: <strong>{schedule?.lastRunAt ? String(schedule.lastRunAt) : "never"}</strong></li>
            <li>Last run for: <strong>{schedule?.lastRunForDate ?? "—"}</strong></li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButtonOutline
              endpoint="/api/reports/morning-brief"
              method="PATCH"
              body={{ enabled: !(schedule?.enabled ?? true), timezone: tz, hourLocal: schedule?.hourLocal ?? 7, minuteLocal: schedule?.minuteLocal ?? 0, channels }}
              label={schedule?.enabled ? "Pause briefings" : "Resume briefings"}
              doneMessage="Schedule updated."
            />
            <ActionButtonOutline endpoint="/api/reports/morning-brief" body={{}} label="Run now" busyLabel="Compiling…" doneMessage="Brief generated." />
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            The in-process <span className="font-mono">npm run scheduler</span> loop and an optional external cron (<span className="font-mono">/api/cron/morning-brief</span> with the CRON_SECRET) both honor this schedule, and the run record dedupes per local date so retries never double-send.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
