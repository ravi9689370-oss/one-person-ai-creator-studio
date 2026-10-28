import { InlineForm } from "@/components/ui/inline-form";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Connected Accounts" };

const PLATFORMS = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "substack", label: "Substack" },
  { value: "spotify", label: "Spotify" },
];

export default async function AccountsPage() {
  const ctx = await pageCtx();
  const accounts = await prisma.socialAccount.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { platform: "asc" } });

  return (
    <PageShell
      title="Connected Accounts"
      subtitle="Publishing adapters require real OAuth authorization. Recording an account as connected without provider-verified credentials would be a data-integrity violation."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card dense>
            {accounts.length === 0 ? (
              <EmptyState title="No accounts" body="Register a platform handle below, then complete the authorization with the provider (see Integrations)." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.platform}{a.handle ? ` · ${a.handle}` : ""}</p>
                      <p className="text-[11px] text-slate-400">
                        last verified {formatRelative(a.lastVerifiedAt)}{a.lastError ? ` · last error: ${a.lastError}` : ""}
                      </p>
                      {a.capLimited && <p className="truncate text-[10px] text-slate-400">caps: {a.capLimited}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.status} />
                      {a.status === "awaiting_authorization" && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-[#1a2148]">OAuth pending - see Integrations</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Register a platform">
          <InlineForm
            endpoint="/api/social/accounts"
            submitLabel="Save account"
            successMessage="Account saved as awaiting authorization - publishing is blocked until the provider verifies it."
            fields={[
              { name: "platform", label: "Platform", type: "select", options: PLATFORMS },
              { name: "handle", label: "Handle", placeholder: "@yourhandle" },
              { name: "status", label: "Initial status", type: "select", options: [
                { value: "awaiting_authorization", label: "Awaiting authorization (default)" },
                { value: "disconnected", label: "Disconnected" },
              ] },
            ]}
          />
          <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            Account status can only be set &ldquo;connected&rdquo; by provider-verified authorization - self-asserted connections never grant publishing rights.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
