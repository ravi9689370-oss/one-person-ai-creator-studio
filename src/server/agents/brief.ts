/**
 * Morning executive brief: aggregates real workspace data (approvals, jobs,
 * leads, orders, publishing failures) into a persisted report. Data-limited
 * sections say so explicitly rather than inventing numbers.
 */
import { prisma } from "@/lib/db";
import { computeLocalNowParts } from "@/lib/time";
import { notify } from "@/server/notifications";

export type BriefSection = { heading: string; lines: string[]; dataQuality: "real" | "partial" | "none" };

export async function generateMorningBrief(workspaceId: string): Promise<{ reportId: string | null; forDate: string; timezone: string; summary: string; isMock: boolean }> {
  const schedule = await prisma.scheduledReport.findUnique({
    where: { workspaceId_kind: { workspaceId, kind: "morning_brief" } },
  });
  const timezone = schedule?.timezone ?? "UTC";
  const { dateKey, localTime } = computeLocalNowParts(timezone);

  const existing = await prisma.report.findUnique({
    where: { workspaceId_kind_forDate_timezone: { workspaceId, kind: "morning_brief", forDate: dateKey, timezone } },
  });
  if (existing) {
    return { reportId: existing.id, forDate: existing.forDate, timezone, summary: "Brief for today already generated.", isMock: existing.isMock };
  }

  const [pendingApprovals, failedTasks, hotLeads, newLeads24h, ordersPending, paidYesterday, failedPosts, duePosts] = await Promise.all([
    prisma.approvalRequest.count({ where: { workspaceId, status: "pending" } }),
    prisma.agentTask.count({ where: { workspaceId, status: "failed" } }),
    prisma.lead.count({ where: { workspaceId, qualification: "high_value" } }),
    prisma.lead.count({ where: { workspaceId, updatedAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
    prisma.order.count({ where: { workspaceId, status: "awaiting_payment" } }),
    prisma.revenueRecord.aggregate({
      where: { workspaceId, kind: "sale", occurredAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.scheduledPost.count({ where: { workspaceId, status: "failed" } }),
    prisma.scheduledPost.count({ where: { workspaceId, status: "approved" } }),
  ]);

  const money = (cents: number | null | undefined) => cents ? `$${(cents / 100).toFixed(2)}` : "$0.00";
  const sections: BriefSection[] = [
    {
      heading: "Sales activity (last 24h)",
      lines: [
        paidYesterday._count ? `${paidYesterday._count} verified sale(s) totaling ${money(paidYesterday._sum.amountCents ?? 0)}.` : "No verified sales in the last 24h.",
        ordersPending ? `${ordersPending} order(s) still awaiting payment verification.` : "No orders awaiting verification.",
      ],
      dataQuality: paidYesterday._count ? "real" : "partial",
    },
    {
      heading: "Leads",
      lines: [
        `${newLeads24h} lead(s) touched in the last 24h.`,
        hotLeads ? `${hotLeads} high-value lead(s) need human attention.` : "No high-value leads flagged.",
      ],
      dataQuality: "real",
    },
    {
      heading: "Production & approvals",
      lines: [
        pendingApprovals ? `${pendingApprovals} item(s) awaiting your approval.` : "Nothing pending approval.",
        failedTasks ? `${failedTasks} failed agent task(s) to inspect.` : "No failed tasks.",
        duePosts ? `${duePosts} approved post(s) ready in the distribution queue.` : "Publishing queue is clear.",
      ],
      dataQuality: "real",
    },
    {
      heading: "Content performance",
      lines: [
        failedPosts ? `${failedPosts} publishing failure(s) recorded.` : "No publishing failures.",
        "Platform metrics appear here once a platform connection is verified (see Integrations).",
      ],
      dataQuality: failedPosts ? "partial" : "none",
    },
    {
      heading: "Recommended next actions",
      lines: [
        pendingApprovals ? "1. Review the approval queue first - production is paused behind it." : "1. Advances are unblocked; start the next workflow in the Director.",
        hotLeads ? "2. Follow up with high-value leads." : "2. Check the CRM for follow-ups.",
        failedTasks ? "3. Inspect failed tasks and their error details." : "3. Review today's calendar.",
      ],
      dataQuality: "real",
    },
  ];

  const isMock = true; // brief generation is deterministic data aggregation; no AI call is required
  const report = await prisma.report.create({
    data: {
      workspaceId,
      scheduledReportId: schedule?.id ?? null,
      kind: "morning_brief",
      forDate: dateKey,
      timezone,
      status: "generated",
      content: JSON.stringify({ generatedAtLocal: localTime, sections }),
      isMock,
    },
  });

  const sched =
    schedule ??
    (await prisma.scheduledReport.upsert({
      where: { workspaceId_kind: { workspaceId, kind: "morning_brief" } },
      create: { workspaceId, kind: "morning_brief", hourLocal: 7, minuteLocal: 0, timezone, channels: '["in_app"]', enabled: true },
      update: {},
    }));
  await prisma.scheduledReport.update({
    where: { id: sched.id },
    data: { lastRunForDate: dateKey, lastRunAt: new Date() },
  });

  await notify.publish(workspaceId, {
    type: "report",
    title: "Morning brief ready",
    body: `Your ${dateKey} briefing is available.`,
    link: "/reports/morning-brief",
  });

  return { reportId: report.id, forDate: dateKey, timezone, summary: `${sections.length} sections compiled from workspace data.`, isMock };
}
