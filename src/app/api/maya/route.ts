/**
 * AI Maya - conversational sales agent API.
 * Maya ALWAYS identifies itself as an AI assistant (system prompt + visual
 * badge). Offerings come from the workspace product catalog. It never promises
 * discounts, availability, or outcomes; high-intent leads are escalated.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody, audit } from "@/server/api";
import { callLlm } from "@/server/providers/llm";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const conversations = await prisma.conversation.findMany({
    where: { workspaceId: auth.ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, channel: true, subject: true, status: true, intent: true, isEscalated: true, createdAt: true, updatedAt: true },
  });
  return ok({ conversations });
}

const messageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  channel: z.enum(["web", "chat", "phone", "whatsapp", "email"]).default("web"),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(4000),
});

const FAQ_HANDLED = ["price", "cost", "how much", "refund", "schedule", "appointment", "book"];

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, messageSchema);
  if ("status" in body) return body as Response;

  let conversation = body.data.conversationId
    ? await prisma.conversation.findFirst({ where: { id: body.data.conversationId, workspaceId: auth.ctx.workspaceId } })
    : null;
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { workspaceId: auth.ctx.workspaceId, channel: body.data.channel, subject: (body.data.subject?.slice(0, 160)) || "Inbound inquiry" },
    });
  }

  await prisma.conversationMessage.create({
    data: { conversationId: conversation.id, role: "user", content: body.data.message },
  });

  const products = await prisma.product.findMany({ where: { workspaceId: auth.ctx.workspaceId, active: true } });
  const catalog = products.map((p) => `${p.name} (${p.kind}) - ${(p.priceCents / 100).toFixed(2).replace(/\.00$/, "")} ${p.currency}, id=${p.id}`).join("\n");
  const knowledge = await prisma.knowledgeDocument.findMany({
    where: { workspaceId: auth.ctx.workspaceId, kind: { in: ["faq", "product", "reference"] } },
    take: 4,
    select: { title: true, content: true },
  });
  const kb = knowledge.map((k) => `# ${k.title}\n${k.content.slice(0, 600)}`).join("\n\n");

  const history = await prisma.conversationMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 12,
  });
  const historyText = history.map((m) => `${m.role === "maya" ? "MAYA" : m.role.toUpperCase()}: ${m.content}`).join("\n");

  const payload = await callLlm({
    system:
      "You are AI Maya, the conversational sales assistant inside the creator's studio. You MUST state clearly that you are an AI assistant whenever you answer. " +
      "Keep replies under 120 words; be honest and never promise discounts, availability, outcomes, or terms that are not in the business configuration. " +
      "Offerings catalog (id needed for recommendations):\n" + catalog + "\nBusiness knowledge base:\n" + kb +
      "\nReturn JSON {reply, intent, recommendation?, escalate: bool, escalation_reason?}.",
    user: `Conversation so far:\n${historyText}\n\nAnswer the latest message.`,
  });

  let parsed: { reply?: string; intent?: string; recommendation?: string; escalate?: boolean; escalation_reason?: string } = {};
  try {
    parsed = JSON.parse(payload.text.replace(/^[^{]*|[^}]*$/g, "")) as typeof parsed;
  } catch {
    // Fallback: deterministic grounded reply (never invents catalog offers).
    const isPriceQ = FAQ_HANDLED.some((k) => body.data.message.toLowerCase().includes(k));
    parsed = {
      reply: isPriceQ
        ? `Hi! I'm AI Maya, ${auth.ctx ? "the studio's" : ""} AI assistant. Current public offerings:\n${catalog}\nI can answer questions; a human will confirm anything beyond that.`
        : `Hi! I'm AI Maya, the studio's AI assistant. Happy to help with questions about offerings, scheduling, or whether they're a fit. What would you like to know?`,
      intent: isPriceQ ? "pricing" : "general",
    };
    payload.mode = "mock";
  }

  const reply = parsed.reply ?? "Hi! I'm AI Maya, the studio's AI assistant. How can I help?";
  const needsHuman = Boolean(parsed.escalate) || intentHigh(parsed.intent ?? "");
  await prisma.conversationMessage.create({
    data: { conversationId: conversation.id, role: "maya", content: reply, intent: parsed.intent ?? null, isMock: payload.mode === "mock" },
  });

  if (needsHuman && !conversation.isEscalated) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { isEscalated: true, status: "escalated", escalationReason: parsed.escalation_reason ?? "Maya requested a human follow-up", handoffAt: new Date() },
    });
    const { notify } = await import("@/server/notifications");
    await notify.publish(auth.ctx.workspaceId, {
      type: "lead",
      title: "AI Maya escalated a conversation",
      body: parsed.escalation_reason ?? "Ask Maya or check the conversation.",
      link: `/ai-maya/conversations/${conversation.id}`,
    });
  }

  // Lead double-write from conversation intent
  if (["course", "coaching", "brand_deal", "pricing", "purchase"].includes(parsed.intent ?? "")) {
    const existingLead = await prisma.lead.findFirst({ where: { mayaConversationId: conversation.id, workspaceId: auth.ctx.workspaceId } });
    const contact = await upsertContact(auth.ctx.workspaceId, body.data.message);
    if (!existingLead) {
      await prisma.lead.create({
        data: {
          workspaceId: auth.ctx.workspaceId,
          contactId: contact.id,
          mayaConversationId: conversation.id,
          name: contact.name,
          email: contact.email ?? "",
          source: "maya",
          intent: parsed.intent ?? "unknown",
          qualification: highValueIntents.includes(parsed.intent ?? "") ? "high_value" : "new",
          notes: `Auto-created from Maya conversation. Last message: ${body.data.message.slice(0, 200)}`,
        },
      });
      await audit(auth.ctx, "maya.lead_logged", "conversation", conversation.id, { intent: parsed.intent }, );
    }
  }

  await prisma.conversation.update({ where: { id: conversation.id }, data: { intent: parsed.intent ?? conversation.intent, updatedAt: new Date() } });

  return ok({
    conversationId: conversation.id,
    reply,
    intent: parsed.intent ?? null,
    recommendation: parsed.recommendation ?? null,
    escalated: needsHuman,
    mock: payload.mode === "mock",
  });
}

const highValueIntents = ["coaching", "brand_deal", "purchase"];

function intentHigh(intent: string): boolean {
  return highValueIntents.includes(intent);
}

async function upsertContact(workspaceId: string, message: string) {
  const emailMatch = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(message);
  const email = emailMatch?.[0]?.toLowerCase();
  const existing = email
    ? await prisma.contact.findFirst({ where: { workspaceId, email } })
    : null;
  if (existing) return existing;
  return prisma.contact.create({
    data: { workspaceId, name: email ? email.split("@")[0].slice(0, 60) : "Maya visitor", email, type: "lead" },
  });
}
