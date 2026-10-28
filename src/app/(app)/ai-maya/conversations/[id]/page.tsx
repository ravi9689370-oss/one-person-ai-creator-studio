import { notFound } from "next/navigation";
import Link from "next/link";
import { ActionButtonOutline } from "@/components/forms/action-button";
import { InlineForm } from "@/components/ui/inline-form";
import { PageShell } from "@/components/ui/page-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/db";
import { pageCtx } from "@/lib/page";
import { formatRelative } from "@/lib/utils";

export const metadata = { title: "Maya Conversation" };

export default async function MayaConversationPage({ params }: { params: { id: string } }) {
  const ctx = await pageCtx();
  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, workspaceId: ctx.workspaceId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();
  const contact = conversation.contactId
    ? await prisma.contact.findUnique({ where: { id: conversation.contactId } })
    : null;
  const lead = conversation.id
    ? await prisma.lead.findFirst({ where: { mayaConversationId: conversation.id, workspaceId: ctx.workspaceId } })
    : null;

  return (
    <PageShell
      title={conversation.subject ?? `Conversation ${conversation.id.slice(-6)}`}
      subtitle={`${conversation.channel} · started ${formatRelative(conversation.createdAt)}${contact ? ` · contact: ${contact.name}` : ""}`}
      actions={<Link href="/ai-maya" className="btn-outline">All conversations</Link>}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Transcript" actions={<StatusBadge status={conversation.status} />}>
            <ol className="space-y-3">
              {conversation.messages.map((m) => (
                <li key={m.id} className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${m.role === "maya" ? "bg-indigo-50 text-indigo-950 dark:bg-[#1a2148] dark:text-indigo-100" : "ml-auto bg-slate-100 text-slate-800 dark:bg-[#232b4d] dark:text-slate-100"}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {m.role === "maya" ? "AI Maya (AI assistant)" : m.role}
                    {m.isMock ? " · DEVELOPMENT FIXTURE" : ""}
                    {m.intent ? ` · intent: ${m.intent}` : ""}
                  </p>
                </li>
              ))}
              {conversation.messages.length === 0 && <p className="text-sm text-slate-400">No messages.</p>}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Handoff">
            {conversation.isEscalated ? (
              <>
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  Escalated: {conversation.escalationReason}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">handed off {formatRelative(conversation.handoffAt)}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">Not escalated. You can hand this to a human:</p>
                <div className="mt-2">
                  <ActionButtonOutline endpoint={`/api/maya/${conversation.id}`} body={{ action: "escalate", reason: "manually escalated by creator" }} label="Escalate to me" doneMessage="Escalated - see notifications." />
                </div>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {conversation.status !== "closed" && (
                <ActionButtonOutline endpoint={`/api/maya/${conversation.id}`} body={{ action: "close" }} label="Close conversation" doneMessage="Closed." />
              )}
              {lead && <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-[#1a2148]">lead exists: {lead.stage}</span>}
            </div>
          </Card>
          <Card title="Continue the thread">
            <InlineForm
              endpoint="/api/maya"
              submitLabel="Send"
              successMessage="Sent - refresh to see the reply."
              fields={[
                { name: "conversationId", label: "Conversation", defaultValue: conversation.id, resetAfter: false, required: true },
                { name: "message", label: "Message", type: "textarea", required: true, min: 1 },
              ]}
            />
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
