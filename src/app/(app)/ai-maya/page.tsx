import Link from "next/link";
import { ActionButtonOutline } from "@/components/forms/action-button";
import { InlineForm } from "@/components/ui/inline-form";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "AI Maya" };

export default async function MayaPage() {
  const ctx = await pageCtx();
  const [conversations, leads] = await Promise.all([
    prisma.conversation.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 15,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 2 } },
    }),
    prisma.lead.findMany({ where: { workspaceId: ctx.workspaceId, mayaConversationId: { not: null } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <PageShell
      title="AI Maya"
      subtitle="Your AI sales assistant. Maya always identifies herself as an AI, grounds answers in your products and knowledge base, and hands humans the deal decisions."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Conversations (${conversations.length})`} dense>
            {conversations.length === 0 ? (
              <EmptyState title="No conversations yet" body="Try the test chat on the right - escalated or commerce-intent visitors are captured as leads." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-[#232b4d]">
                {conversations.map((c) => {
                  const last = c.messages[0];
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <Link href={`/ai-maya/conversations/${c.id}`} className="text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100">
                          {c.subject ?? `Conversation ${c.id.slice(-6)}`}
                        </Link>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {last ? `${last.role === "maya" ? "Maya" : "Visitor"}: ${last.content}` : "(no messages)"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {c.channel} · {formatRelative(c.updatedAt)}{c.isEscalated ? ` · escalated: ${c.escalationReason ?? "human requested"}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={c.status} isMock={last?.isMock} />
                        {c.status !== "closed" && (
                          <ActionButtonOutline endpoint={`/api/maya/${c.id}`} body={{ action: "close" }} label="Close" doneMessage="Closed." />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Leads from Maya" actions={<Link href="/crm/leads" className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">All leads →</Link>}>
            {leads.length === 0 ? (
              <p className="text-xs text-slate-400">Commerce-intent chats will create leads here automatically with their source recorded.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {leads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{l.name}</span>
                    <span className="text-slate-400">{l.intent ?? "?"} · {l.stage}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title="Test the assistant">
          <InlineForm
            endpoint="/api/maya"
            submitLabel="Send message"
            successMessage="Maya replied - refresh the page to see it."
            fields={[
              { name: "channel", label: "Channel", type: "select", options: [
                { value: "web", label: "Web" },
                { value: "chat", label: "Chat widget" },
                { value: "whatsapp", label: "WhatsApp" },
                { value: "email", label: "Email" },
                { value: "phone", label: "Phone" },
              ] },
              { name: "subject", label: "Subject", placeholder: "Inbound inquiry" },
              { name: "message", label: "Message", type: "textarea", required: true, min: 2, placeholder: "How much is your coaching?" },
            ]}
          >
            <p className="text-[11px] text-slate-400">
              Maya identifies as AI in every reply. Without configured credentials, replies use the deterministic dev-fixture mode and are marked as such.
            </p>
          </InlineForm>
        </Card>
      </div>
    </PageShell>
  );
}
