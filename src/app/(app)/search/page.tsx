import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { param } from "@/components/ui/filters";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const ctx = await pageCtx();
  const q = param(searchParams.q)?.trim() ?? "";
  const needsQuery = q.length < 2;

  const [scripts, topics, tasks, docs, leads, clips] = needsQuery
    ? [[], [], [], [], [], []]
    : await Promise.all([
        prisma.script.findMany({ where: { workspaceId: ctx.workspaceId, OR: [{ title: { contains: q } }, { hook: { contains: q } }] }, take: 8 }),
        prisma.contentTopic.findMany({ where: { workspaceId: ctx.workspaceId, OR: [{ title: { contains: q } }, { notes: { contains: q } }] }, take: 6 }),
        prisma.agentTask.findMany({ where: { workspaceId: ctx.workspaceId, OR: [{ type: { contains: q } }, { summary: { contains: q } }] }, take: 8 }),
        prisma.knowledgeDocument.findMany({ where: { workspaceId: ctx.workspaceId, OR: [{ title: { contains: q } }, { content: { contains: q } }] }, take: 6 }),
        prisma.lead.findMany({ where: { workspaceId: ctx.workspaceId, OR: [{ name: { contains: q } }, { email: { contains: q } }] }, take: 6 }),
        prisma.mediaAsset.findMany({ where: { workspaceId: ctx.workspaceId, title: { contains: q } }, take: 6 }),
      ]);

  const total = scripts.length + topics.length + tasks.length + docs.length + leads.length + clips.length;

  return (
    <PageShell title="Search" subtitle="Cross-module lookup over scripts, topics, tasks, knowledge, leads, and media.">
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search everything…"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-[#2c3560] dark:bg-[#0b1020]"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Search</button>
      </form>

      {needsQuery ? (
        <Card><EmptyState title="Type something to search" body="At least 2 characters. Search covers titles, summaries, and key text fields across modules." /></Card>
      ) : total === 0 ? (
        <Card><EmptyState title={`No results for “${q}”`} body="Try a shorter or different term - search is scoped to your workspace." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[
            ...scripts.map((s) => ({ group: "Scripts", label: s.title, href: `/scripts/${s.id}` })),
            ...topics.map((t) => ({ group: "Topics", label: t.title, href: "/workspace/topics" })),
            ...tasks.map((t) => ({ group: "Tasks", label: `${t.type} — ${t.summary ?? ""}`, href: `/studio/tasks/${t.id}` })),
            ...docs.map((d) => ({ group: "Knowledge", label: d.title, href: "/workspace/knowledge" })),
            ...leads.map((l) => ({ group: "Leads", label: l.name, href: "/crm/leads" })),
            ...clips.map((a) => ({ group: "Media", label: a.title, href: "/workspace/media-library" })),
          ].map((hit, i) => (
            <Link key={`${hit.group}-${hit.label}-${i}`} href={hit.href} className="card px-4 py-3 transition hover:shadow-pop">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{hit.group}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{hit.label}</p>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
