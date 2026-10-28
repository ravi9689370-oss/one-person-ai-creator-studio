import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { InlineForm } from "@/components/ui/inline-form";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Brand Profile" };

export default async function BrandProfilePage() {
  const ctx = await pageCtx();
  const brand = await prisma.brandProfile.findUnique({
    where: { workspaceId: ctx.workspaceId },
    include: { personas: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <PageShell title="Brand Profile" subtitle="Voice, tone, mission, and audience personas. Every agent reads this before generating anything.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Brand identity">
            {brand ? (
              <InlineForm
                endpoint="/api/brand"
                method="PATCH"
                submitLabel="Save brand profile"
                successMessage="Brand profile updated - agents will use it on the next run."
                fields={[
                  { name: "displayName", label: "Display name", defaultValue: brand.displayName, resetAfter: false, required: true },
                  { name: "tagline", label: "Tagline", defaultValue: brand.tagline ?? "", resetAfter: false },
                  { name: "tone", label: "Tone", defaultValue: brand.tone, resetAfter: false },
                  { name: "audience", label: "Audience", type: "textarea", defaultValue: brand.audience ?? "", resetAfter: false, min: 3 },
                  { name: "mission", label: "Mission", type: "textarea", defaultValue: brand.mission ?? "", resetAfter: false, min: 3 },
                  { name: "voice", label: "Voice description", type: "textarea", defaultValue: brand.voice ?? "", resetAfter: false, min: 3 },
                  { name: "guidelines", label: "Brand guidelines", type: "textarea", defaultValue: brand.guidelines ?? "", resetAfter: false, min: 3 },
                ]}
              />
            ) : (
              <EmptyState
                title="No brand profile yet"
                body="Create your brand profile so scripts, thumbnails, and Maya replies sound like you."
                action={{ label: "Complete onboarding", href: "/onboarding" }}
              />
            )}
          </Card>

          {brand && (
            <Card title={`Audience personas (${brand.personas.length})`}>
              {brand.personas.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No personas defined yet. Add them in onboarding or via the Brand API - agents use them to target hooks and ideas.
                </p>
              ) : (
                <ul className="space-y-3">
                  {brand.personas.map((p) => (
                    <li key={p.id} className="rounded-lg border border-slate-100 p-3 dark:border-[#232b4d]">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                      {p.description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{p.description}</p>}
                      {p.painPoints && <p className="mt-1 text-[11px] text-slate-400">Pain points: {p.painPoints}</p>}
                      {p.goals && <p className="text-[11px] text-slate-400">Goals: {p.goals}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="How this is used">
            <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li>• Script Agent applies your voice + tone to every draft.</li>
              <li>• Strategy Agent targets ideas at audience pain points.</li>
              <li>• AI Maya answers in brand voice and never over-promises.</li>
              <li>• You can layer platform-specific rules in Style Guides.</li>
            </ul>
          </Card>
          {brand && <Card title="Last updated"><p className="text-sm text-slate-600 dark:text-slate-300">{formatRelative(brand.updatedAt)}</p></Card>}
        </div>
      </div>
    </PageShell>
  );
}
