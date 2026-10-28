import { ActionButton } from "@/components/forms/action-button";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { InlineForm } from "@/components/ui/inline-form";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Content Calendar" };

export default async function ContentCalendarPage() {
  const ctx = await pageCtx();
  const now = new Date();
  const [workspace, items, undated] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { timezone: true } }),
    prisma.calendarItem.findMany({
      where: { workspaceId: ctx.workspaceId, scheduledFor: { gte: new Date(now.getTime() - 7 * 86400_000) } },
      orderBy: { scheduledFor: "asc" },
      take: 50,
    }),
    prisma.calendarItem.findMany({ where: { workspaceId: ctx.workspaceId, scheduledFor: null }, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);
  const tz = workspace?.timezone ?? "UTC";

  return (
    <PageShell title="Content Calendar" subtitle="Plan what ships when - DST-safe scheduling happens in your workspace timezone.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Scheduled (upcoming + last 7 days)" dense>
            {items.length === 0 ? (
              <EmptyState
                title="Nothing scheduled"
                body="Add a calendar entry here or let approvals push publish-ready work onto the calendar."
                action={{ label: "Review pending work", href: "/approvals" }}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{c.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {c.channel ? `${c.channel} · ` : ""}{formatDate(c.scheduledFor)} ({tz})
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {undated.length > 0 && (
            <Card title="Backlog (no date set)" dense>
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {undated.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <p className="truncate text-sm text-slate-700 dark:text-slate-300">{c.title}</p>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <Card title="New calendar entry">
          <InlineForm
            endpoint="/api/calendar"
            submitLabel="Add to calendar"
            successMessage="Added."
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "channel", label: "Channel", placeholder: "youtube / tiktok / linkedin…" },
              { name: "scheduledFor", label: "Date & time", type: "datetime-local" },
              { name: "notes", label: "Notes", type: "textarea", min: 3 },
            ]}
          />
          <p className="mt-2 text-[11px] text-slate-400">Local date/time is interpreted in your workspace timezone ({tz}).</p>
        </Card>
      </div>
    </PageShell>
  );
}
