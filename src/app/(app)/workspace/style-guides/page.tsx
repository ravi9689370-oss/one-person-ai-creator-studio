import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { InlineForm } from "@/components/ui/inline-form";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Style Guides" };

export default async function StyleGuidesPage() {
  const ctx = await pageCtx();
  const guides = await prisma.styleGuide.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { updatedAt: "desc" }, take: 50 });

  return (
    <PageShell title="Style Guides" subtitle="Per-platform rules layered on top of your brand voice.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`Guides (${guides.length})`} dense>
            {guides.length === 0 ? (
              <EmptyState
                title="No style guides yet"
                body="Add rules like pacing, hook style, and banned phrases per platform so agents follow them consistently."
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {guides.map((g) => (
                  <li key={g.id} className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {g.name}
                      {g.platform ? <span className="ml-2 text-xs font-normal text-slate-400">for {g.platform}</span> : null}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">{g.rules.slice(0, 400)}</p>
                    <p className="mt-1 text-[11px] text-slate-400">updated {formatDate(g.updatedAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="New style guide">
          <InlineForm
            endpoint="/api/style-guides"
            submitLabel="Create guide"
            successMessage="Style guide saved."
            fields={[
              { name: "name", label: "Name", required: true, placeholder: "e.g. YouTube pacing rules" },
              { name: "platform", label: "Platform", placeholder: "youtube / tiktok / instagram…" },
              { name: "rules", label: "Rules", type: "textarea", required: true, min: 6 },
            ]}
          />
        </Card>
      </div>
    </PageShell>
  );
}
