/**
 * Stripe webhook endpoint. Signature verification happens BEFORE any state
 * change; unverified events are stored for audit but never mutate orders.
 * Never mark an order paid merely because the frontend reported success.
 */
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { providerEnv } from "@/lib/env";

const narrowTimestampToleranceSec = 300;

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  const env = providerEnv();
  const endpointSecret = env.stripeWebhookSecret ?? "";

  let parsed: {
    id?: string;
    type?: string;
    data?: { object?: { id?: string; amount?: number; metadata?: { orderId?: string; workspaceId?: string } } };
  } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    await prisma.paymentEvent.create({
      data: { workspaceId: null, provider: "stripe", type: "unparseable", signatureVerified: false, error: "JSON invalid" },
    });
    return new Response("bad payload", { status: 400 });
  }

  const verified = verifyStripeSig(raw, sig, endpointSecret);
  const orderId = parsed.data?.object?.metadata?.orderId ?? null;
  const workspaceId = parsed.data?.object?.metadata?.workspaceId ?? null;

  const event = await prisma.paymentEvent.create({
    data: {
      workspaceId,
      orderId,
      provider: "stripe",
      type: parsed.type ?? "unknown",
      payload: JSON.stringify({ id: parsed.id, type: parsed.type, amount: parsed.data?.object?.amount ?? null, orderId }).slice(0, 4000),
      signatureVerified: verified,
      processed: false,
      error: verified ? null : "signature_invalid_or_missing",
    },
  });

  if (!verified) {
    return new Response("Signature invalid", { status: 400 });
  }

  if (workspaceId && parsed.type === "payment_intent.succeeded") {
    const order = await prisma.order.findFirst({
      where: { workspaceId, OR: [{ id: orderId ?? "" }, ...(orderId ? [] : [])], provider: { in: ["stripe", "manual"] } },
    });
    if (order) {
      if (!order.verifiedByIdEvent || order.status !== "paid") {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "paid", verifiedAt: new Date(), verifiedByIdEvent: event.id, provider: "stripe" },
        });
        await prisma.revenueRecord.create({
          data: {
            workspaceId,
            orderId: order.id,
            source: "order",
            kind: "sale",
            amountCents: order.amountCents,
            currency: order.currency,
            label: "Stripe verified payment",
          },
        });
        await prisma.invoice.updateMany({ where: { orderId: order.id }, data: { status: "paid" } });
        const { notify } = await import("@/server/notifications");
        await notify.publish(workspaceId, { type: "payment", title: "Payment verified", body: `Order ${order.id} marked paid via verified Stripe event.`, link: "/monetization/orders" });
      }
      await prisma.paymentEvent.update({ where: { id: event.id }, data: { processed: true } });
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
  }
  return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200, headers: { "content-type": "application/json" } });
}

/** Stripe signature scheme: v1 HMAC-SHA256 over `${timestamp}.${payload}`. */
function verifyStripeSig(payload: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as { v1?: string; t?: string };
  if (!parts.v1 || !parts.t) return false;
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (age > narrowTimestampToleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  } catch {
    return false;
  }
}
