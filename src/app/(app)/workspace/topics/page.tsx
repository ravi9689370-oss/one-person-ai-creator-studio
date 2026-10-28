import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { InlineForm } from "@/components/ui/inline-form";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterPills, param } from "@/components/ui/filters";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";

export const metadata = { title: "Topics" };

const STATUSES = [
  { value: "all", label: "All" },
  { value: "idea", label: "Ideas" },
  { value: "researched", label: "Researched" },
  { value: "scripted", label: "Scripted" },
  { value: "produced", label: "Produced" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export default async function TopicsPage({ searchParams }: { searchParams: { status?: string } }) {
  const ctx = await pageCtx();
  const status = param(searchParams.status) ?? "all";
  const topics = await prisma.contentTopic.findMany({
    where: { workspaceId: ctx.workspaceId, ...(status !== "all" ? { status } : {}) },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });

  return (
    <PageShell title="Topics" subtitle="Your idea backlog. Research and strategy agents turn these into briefs and scripts.">
      <FilterPills base="/workspace/topics" param="status" current={status} options={STATUSES} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`${topics.length} topics`} dense>
            {topics.length === 0 ? (
              <EmptyState
                title="No topics in this bucket"
                body="Capture your first idea on the right - or ask the Strategy Agent to propose some."
                action={{ label: "Ask Strategy Agent", href: "/studio/director" }}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {topics.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.title}</p>
                      {t.notes && <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{t.notes}</p>}
                      <p className="mt-0.5 text-[11px] text-slate-400">{t.category ? `${t.category} · ` : ""}priority {t.priority}</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Add a topic">
            <InlineForm
              endpoint="/api/topics"
              submitLabel="Save topic"
              successMessage="Topic added to the backlog."
              fields={[
                { name: "title", label: "Title", required: true, placeholder: "What should this piece be about?" },
                { name: "category", label: "Category", placeholder: "e.g. monetization" },
                { name: "priority", label: "Priority", type: "select", options: [
                  { value: "high", label: "High" },
                  { value: "normal", label: "Normal" },
                  { value: "low", label: "Low" },
                ] },
                { name: "notes", label: "Notes", type: "textarea", min: 3 },
              ]}
            />
          </Card>
          <Card title="Pipeline">
            <Link href="/scripts" className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400">See scripts →</Link>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
