import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "CRM" };

const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "meeting", label: "Meeting" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export default async function CrmPage() {
  const ctx = await pageCtx();
  const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { currency: true } });
  const currency = workspace?.currency ?? "USD";
  const [leads, contacts, appts, activities] = await Promise.all([
    prisma.lead.findMany({ where: { workspaceId: ctx.workspaceId } }),
    prisma.contact.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.appointment.findMany({ where: { workspaceId: ctx.workspaceId, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 8 }),
    prisma.crmActivity.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <PageShell
      title="CRM"
      subtitle="A single pipeline for leads, meetings, and follow-ups. Maya feeds it automatically; you control every qualification."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((s) => (
          <Link key={s.key} href={`/crm/leads?stage=${s.key}`} className="card block p-3 transition hover:shadow-pop">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{leads.filter((l) => l.stage === s.key).length}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Recent contacts" actions={<Link href="/crm/leads" className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Pipeline →</Link>}>
          {contacts.length === 0 ? (
            <p className="text-xs text-slate-400">No contacts yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {contacts.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{c.name}</span>
                  <span className="truncate text-slate-400">{c.email ?? c.phone ?? c.company ?? c.type}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Upcoming appointments">
          {appts.length === 0 ? (
            <p className="text-xs text-slate-400">None scheduled. Maya can book meetings from the knowledge base rules.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {appts.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{a.title}</span>
                  <span className="shrink-0 text-slate-400">{a.startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Latest activity">
          {activities.length === 0 ? (
            <p className="text-xs text-slate-400">No activity logged yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {activities.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="truncate text-slate-700 dark:text-slate-300">{a.type}: {a.content}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Pipeline value">
        <p className="text-3xl font-bold">
          {formatMoney(
            leads.filter((l) => ["new", "contacted", "meeting", "proposal"].includes(l.stage)).reduce((sum, l) => sum + (l.estimatedValueCents ?? 0), 0),
            currency,
          )}
        </p>
        <p className="mt-1 text-xs text-slate-500">Sum of estimated values for open leads.</p>
      </Card>
    </PageShell>
  );
}
