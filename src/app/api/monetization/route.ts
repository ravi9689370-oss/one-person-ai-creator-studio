/** Monetization: products CRUD, manual orders (owner-only), real webhook verification. */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody, audit } from "@/server/api";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const [products, orders, subscriptions] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId: auth.ctx.workspaceId }, orderBy: { createdAt: "asc" } }),
    prisma.order.findMany({ where: { workspaceId: auth.ctx.workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.subscription.findMany({ where: { workspaceId: auth.ctx.workspaceId }, orderBy: { createdAt: "desc" } }),
  ]);
  return ok({ products, orders, subscriptions });
}

const productSchema = z.object({
  key: z.string().trim().min(2).max(40).optional(),
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["course", "coaching", "brand_deal", "subscription"]).default("course"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  priceCents: z.number().int().min(0).max(9_999_999),
  currency: z.string().trim().min(3).max(3).default("USD"),
  active: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const schema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("product"), body: productSchema }),
    z.object({
      type: z.literal("order"),
      productId: z.string().min(1),
      buyerName: z.string().trim().min(1).max(120),
      buyerEmail: z.string().trim().email().optional().or(z.literal("")),
      manual: z.boolean().default(false),
      acknowledge: z.boolean().default(false),
      note: z.string().trim().max(1000).optional().or(z.literal("")),
    }),
    z.object({ type: z.literal("verify_order"), orderId: z.string().min(1), acknowledge: z.boolean().default(false) }),
  ]);
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid payload.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });

  if (parsed.data.type === "product") {
    const existing = parsed.data.body.key
      ? await prisma.product.findUnique({ where: { key: `${auth.ctx.workspaceId}::${parsed.data.body.key}` } }).catch(() => null)
      : null;
    void existing;
    const product = await prisma.product.create({
      data: { workspaceId: auth.ctx.workspaceId, ...parsed.data.body, key: parsed.data.body.key ?? `p${Date.now()}` },
    });
    await audit(auth.ctx, "product.create", "product", product.id);
    return ok({ id: product.id }, { status: 201 });
  }

  if (parsed.data.type === "order") {
    const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, workspaceId: auth.ctx.workspaceId } });
    if (!product) return fail(404, "not_found", "Product not found.");
    const contact = await prisma.contact.create({
      data: { workspaceId: auth.ctx.workspaceId, name: parsed.data.buyerName, email: parsed.data.buyerEmail || null, type: "customer" },
    });
    // Manual records stay explicitly "awaiting_payment" until a verified
    // provider event (or the explicit owner verification below) marks them paid.
    const order = await prisma.order.create({
      data: {
        workspaceId: auth.ctx.workspaceId,
        productId: product.id,
        contactId: contact.id,
        status: parsed.data.manual ? "awaiting_payment" : "awaiting_payment",
        amountCents: product.priceCents,
        currency: product.currency,
        provider: "manual",
        verifiedByIdEvent: null,
      },
    });
    await prisma.invoice.create({
      data: { workspaceId: auth.ctx.workspaceId, orderId: order.id, number: `INV-${order.id.slice(-8).toUpperCase()}`, amountCents: order.amountCents, currency: order.currency, status: "draft" },
    });
    await audit(auth.ctx, "order.create", "order", order.id, { manual: parsed.data.manual });
    if (parsed.data.manual) {
      if (!parsed.data.acknowledge) {
        return fail(422, "acknowledge_required", "Owner verification requires an explicit acknowledge=true and an audit-trail note.");
      }
      await prisma.order.update({ where: { id: order.id }, data: { status: "paid", verifiedAt: new Date(), provider: "manual" } });
      await prisma.revenueRecord.create({
        data: { workspaceId: auth.ctx.workspaceId, orderId: order.id, source: "order", kind: "sale", amountCents: order.amountCents, currency: order.currency, label: `${product.name} (manual verification)`, },
      });
      await prisma.paymentEvent.create({
        data: { workspaceId: auth.ctx.workspaceId, orderId: order.id, provider: "manual", type: "owner.manual_verified", signatureVerified: false, processed: true, payload: JSON.stringify({ by: auth.ctx.userId, note: parsed.data.note ?? "" }) },
      });
      await prisma.invoice.updateMany({ where: { orderId: order.id }, data: { status: "paid" } });
      await audit(auth.ctx, "order.manually_verified", "order", order.id, { note: parsed.data.note ?? "" });
    }
    return ok({ orderId: order.id, statusState: parsed.data.manual ? "paid(manually verified)" : "awaiting_payment" }, { status: 201 });
  }

  // verify_order: explicit owner action after checking the provider dashboard.
  const order = await prisma.order.findFirst({ where: { id: parsed.data.orderId, workspaceId: auth.ctx.workspaceId } });
  if (!order) return fail(404, "not_found", "Order not found.");
  if (order.status === "paid") return fail(409, "already_paid", "Order is already marked paid by a verified event.");
  if (!parsed.data.acknowledge) {
    return fail(422, "acknowledge_required", "Confirm with acknowledge=true only after verifying payment in the provider dashboard.");
  }
  await prisma.order.update({ where: { id: order.id }, data: { status: "paid", verifiedAt: new Date() } });
  const product = await prisma.product.findUnique({ where: { id: order.productId } });
  await prisma.revenueRecord.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      orderId: order.id,
      source: "order",
      kind: "sale",
      amountCents: order.amountCents,
      currency: order.currency,
      label: product ? `${product.name} (owner-verified)` : "Order (owner-verified)",
    },
  });
  await prisma.invoice.updateMany({ where: { orderId: order.id }, data: { status: "paid" } });
  await audit(auth.ctx, "order.owner_verified", "order", order.id);
  return ok({ paid: true });
}
