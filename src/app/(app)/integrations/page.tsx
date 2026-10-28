import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Integrations" };

const CATEGORY_TITLES: Record<string, string> = {
  ai: "AI providers (LLM · TTS · ASR · image · video)",
  social: "Social publishing",
  payments: "Payments & commerce",
  communications: "Communications & booking",
  media: "Media tools",
  storage: "Storage",
  analytics: "Analytics boundaries",
};

export default async function IntegrationsPage() {
  const ctx = await pageCtx();
  const integrations = await prisma.integration.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: [{ category: "asc" }, { providerKey: "asc" }] });
  const byCategory = new Map<string, typeof integrations>();
  for (const i of integrations) byCategory.set(i.category, [...(byCategory.get(i.category) ?? []), i]);

  const socialAccounts = await prisma.socialAccount.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { platform: "asc" } });

  return (
    <PageShell
      title="Integrations"
      subtitle="Provider status is derived from actual configuration detection - columns never say 'connected' because the UI hoped they were."
    >
      {integrations.length === 0 ? (
        <Card><EmptyState title="No integrations registered" body="Run workspace onboarding to register the provider boundary matrix." action={{ label: "Onboarding", href: "/onboarding" }} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from(byCategory.entries()).map(([cat, list]) => (
            <Card key={cat} title={CATEGORY_TITLES[cat] ?? cat} dense>
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {list.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{i.providerKey}</p>
                      {i.capabilityNotes && <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{i.capabilityNotes}</p>}
                      {i.lastError && <p className="text-[10px] text-rose-500">{i.lastError}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {i.isMock && <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">DEV FIXTURE</span>}
                      <StatusBadge status={i.status === "unsupported" ? "failed" : i.status} />
                      {i.lastSuccessAt && <span className="text-[10px] text-slate-400">{formatDate(i.lastSuccessAt)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <Card title="Social accounts (authorization state)" dense>
            {socialAccounts.length === 0 ? (
              <p className="px-4 py-2 text-xs text-slate-400">No platforms registered. Register handles in Distribution → Accounts.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {socialAccounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.platform}</p>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
      <Card title="How status is derived">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold">operational</span> = configured and verified by a real call · <span className="font-semibold">awaiting_credentials</span> = boundary registered, env vars unset ·
          <span className="font-semibold"> awaiting_authorization</span> = OAuth needed (social) · <span className="font-semibold">manual</span> = intentional no-API workflow · <span className="font-semibold">unsupported</span> = platform has no API in scope.
          Statuses refresh from environment detection; the UI cannot set them by hand.
        </p>
      </Card>
    </PageShell>
  );
}
