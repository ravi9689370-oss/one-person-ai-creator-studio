import { ActionButtonOutline } from "@/components/forms/action-button";
import { InlineForm } from "@/components/ui/inline-form";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterPills, param } from "@/components/ui/filters";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Leads" };

const STAGES = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting", label: "Meeting" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export default async function LeadsPage({ searchParams }: { searchParams: { stage?: string; qualification?: string } }) {
  const ctx = await pageCtx();
  const stage = param(searchParams.stage) ?? "all";
  const qualification = param(searchParams.qualification) ?? "all";
  const stageValid = STAGES.some((s) => s.value === stage) && stage !== "all" ? stage : undefined;
  const qualValid = ["new", "qualified", "unqualified", "high_value"].includes(qualification) && qualification !== "all" ? qualification : undefined;
  const leads = await prisma.lead.findMany({
    where: { workspaceId: ctx.workspaceId, ...(stageValid ? { stage: stageValid } : {}), ...(qualValid ? { qualification: qualValid } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <PageShell title="Leads" subtitle="Qualify and move them along. High-value leads surface in your morning brief and dashboard.">
      <div className="flex flex-wrap gap-3">
        <FilterPills base="/crm/leads" param="stage" current={stage} options={STAGES} />
        <FilterPills base="/crm/leads" param="qualification" current={qualification} options={[
          { value: "all", label: "Any quality" },
          { value: "high_value", label: "High value" },
          { value: "qualified", label: "Qualified" },
          { value: "new", label: "Unprocessed" },
          { value: "unqualified", label: "Unqualified" },
        ]} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card dense>
            {leads.length === 0 ? (
              <EmptyState title="No leads in this view" body="Maya auto-captures commerce-intent conversations; you can add leads manually on the right." />
            ) : (
              <DataTable
                rows={leads}
                columns={[
                  { header: "Lead", render: (l) => <div><p className="font-semibold text-slate-800 dark:text-slate-100">{l.name}</p><p className="text-[11px] text-slate-400">{l.email ?? "no email"} · via {l.source}{l.intent ? ` · ${l.intent}` : ""}</p></div> },
                  { header: "Quality", render: (l) => <StatusBadge status={l.qualification === "high_value" ? "verified" : l.qualification} /> },
                  { header: "Stage", render: (l) => <StatusBadge status={l.stage === "won" ? "approved" : l.stage === "lost" ? "failed" : "queued" } /> },
                  { header: "Est. value", render: (l) => <span className="text-xs">{l.estimatedValueCents ? `$${(l.estimatedValueCents / 100).toFixed(0)}` : "—"}</span>, hideOnMobile: true },
                  { header: "Added", render: (l) => <span className="text-xs text-slate-400">{formatRelative(l.createdAt)}</span>, hideOnMobile: true },
                  {
                    header: "Advance",
                    render: (l) => (
                      <div className="flex gap-1.5">
                        {l.stage === "new" && (
                          <ActionButtonOutline endpoint={`/api/crm/leads/${l.id}`} method="PATCH" body={{ stage: "contacted", qualification: l.qualification === "new" ? "qualified" : l.qualification }} label="Mark contacted" doneMessage="Stage updated." />
                        )}
                        {l.stage === "contacted" && (
                          <ActionButtonOutline endpoint={`/api/crm/leads/${l.id}`} method="PATCH" body={{ stage: "meeting" }} label="Set meeting" doneMessage="Stage updated." />
                        )}
                        {l.stage === "meeting" && (
                          <ActionButtonOutline endpoint={`/api/crm/leads/${l.id}`} method="PATCH" body={{ stage: "proposal" }} label="Send proposal" doneMessage="Stage updated." />
                        )}
                        {l.stage === "proposal" && (
                          <ActionButtonOutline endpoint={`/api/crm/leads/${l.id}`} method="PATCH" body={{ stage: "won" }} label="Mark won" doneMessage="Won! 🎉" />
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </div>
        <Card title="Add lead">
          <InlineForm
            endpoint="/api/crm/leads"
            submitLabel="Add lead"
            successMessage="Lead created."
            fields={[
              { name: "name", label: "Name", required: true },
              { name: "email", label: "Email" },
              { name: "source", label: "Source", type: "select", options: [
                { value: "manual", label: "Manual" },
                { value: "referral", label: "Referral" },
                { value: "social", label: "Social" },
                { value: "maya", label: "AI Maya" },
              ] },
              { name: "intent", label: "Intent", placeholder: "course / coaching / brand_deal" },
              { name: "estimatedValueCents", label: "Est. value (cents)", type: "number", min: 0 },
              { name: "notes", label: "Notes", type: "textarea", min: 3 },
            ]}
          />
        </Card>
      </div>
    </PageShell>
  );
}
