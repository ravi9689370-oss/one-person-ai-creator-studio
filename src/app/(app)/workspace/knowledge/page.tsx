import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { InlineForm } from "@/components/ui/inline-form";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";

export const metadata = { title: "Knowledge Base" };

export default async function KnowledgePage() {
  const ctx = await pageCtx();
  const docs = await prisma.knowledgeDocument.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { updatedAt: "desc" }, take: 100 });
  const chunks = await prisma.knowledgeChunk.groupBy({ by: ["documentId"], _count: { documentId: true } });
  const chunkCount = Object.fromEntries(chunks.map((c) => [c.documentId, c._count.documentId]));

  return (
    <PageShell title="Knowledge Base" subtitle="Facts, FAQs, product notes, and references every agent can search.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`Documents (${docs.length})`} dense>
            {docs.length === 0 ? (
              <EmptyState
                title="Knowledge base is empty"
                body="Add product details, FAQs, and research references - the Script Agent and AI Maya ground their answers here."
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {docs.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.title}</p>
                      <StatusBadge status={d.kind === "faq" ? "approved" : "queued"} isMock={false} />
                    </div>
                    {d.content && <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{d.content.slice(0, 240)}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">kind: {d.kind} · {chunkCount[d.id] ?? 0} chunks indexed</p>
                    {d.assetId && <p className="text-[11px] text-slate-400">attached media: {d.assetId}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Add a document">
          <InlineForm
            endpoint="/api/knowledge"
            submitLabel="Add to knowledge base"
            successMessage="Document added."
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "kind", label: "Kind", type: "select", options: [
                { value: "reference", label: "Reference" },
                { value: "faq", label: "FAQ" },
                { value: "product", label: "Product" },
                { value: "voice_note", label: "Voice note" },
              ] },
              { name: "content", label: "Content", type: "textarea", min: 6, placeholder: "Paste facts, links, product details…" },
            ]}
          />
        </Card>
      </div>
    </PageShell>
  );
}
