import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterPills, param } from "@/components/ui/filters";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineForm } from "@/components/ui/inline-form";
import { ActionButtonOutline } from "@/components/forms/action-button";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Scripts" };

const STATUSES = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "pending_approval", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "needs_revision", label: "Needs revision" },
  { value: "archived", label: "Archived" },
];

export default async function ScriptsPage({ searchParams }: { searchParams: { status?: string } }) {
  const ctx = await pageCtx();
  const status = param(searchParams.status) ?? "all";
  const valid = STATUSES.some((s) => s.value === status) && status !== "all" ? status : undefined;
  const [scripts, topics] = await Promise.all([
    prisma.script.findMany({
      where: { workspaceId: ctx.workspaceId, ...(valid ? { status: valid } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, format: true, platform: true, language: true, status: true, currentVersion: true, hook: true, updatedAt: true },
    }),
    prisma.contentTopic.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true } }),
  ]);

  return (
    <PageShell title="Scripts" subtitle="Drafts, versions, and approvals. Approved scripts are archived rather than deleted, so history is never lost.">
      <FilterPills base="/scripts" param="status" current={status} options={STATUSES} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`${scripts.length} scripts`} dense>
            {scripts.length === 0 ? (
              <EmptyState
                title="No scripts in this view"
                body="Write one below or ask the Script Agent to draft from a topic."
                action={{ label: "Ask the Director", href: "/studio/director" }}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {scripts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <Link href={`/scripts/${s.id}`} className="text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100">{s.title}</Link>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{s.hook ?? "—"}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {s.format} · {s.platform} · {s.language} · v{s.currentVersion} · {formatRelative(s.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={s.status} />
                      {s.status !== "pending_approval" ? (
                        <ActionButtonOutline
                          endpoint={`/api/scripts/${s.id}/generate`}
                          body={{ scriptId: s.id }}
                          label="Send for approval"
                          doneMessage="Submitted for approval."
                        />
                      ) : (
                        <span className="text-xs text-slate-400">in review</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="New script">
          <InlineForm
            endpoint="/api/scripts"
            submitLabel="Save draft"
            successMessage="Draft saved."
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "format", label: "Format", type: "select", options: [
                { value: "long_form", label: "Long form" },
                { value: "short_form", label: "Short form" },
                { value: "outline", label: "Outline" },
                { value: "sponsor_read", label: "Sponsor read" },
              ] },
              { name: "platform", label: "Platform", defaultValue: "youtube" },
              { name: "language", label: "Language", defaultValue: "en" },
              ...(topics.length > 0
                ? [{ name: "topicId", label: "Topic (optional)", type: "select" as const, options: topics.map((t) => ({ value: t.id, label: t.title })) }]
                : []),
              { name: "hook", label: "Hook (optional)" },
              { name: "body", label: "Body", type: "textarea", min: 6, required: true, placeholder: "Paste or write the draft - AI revision can expand it later." },
            ]}
          />
        </Card>
      </div>
    </PageShell>
  );
}
