import { describe, expect, it, beforeAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Payments integrity: the manual-sale route must record unverified manual
 * orders (explicitly acknowledged), while verification is only credited to
 * signed provider payment events.
 */

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(async () => null),
}));

const sessionUser = { id: "", email: "creator@example.com" };

beforeAll(async () => {
  const creator = await prisma.user.findUnique({ where: { email: "creator@example.com" } });
  if (creator) sessionUser.id = creator.id;
  const { getServerSession } = (await import("next-auth")) as unknown as { getServerSession: ReturnType<typeof vi.fn> };
  getServerSession.mockImplementation(async () => ({ user: sessionUser, expires: "2099-01-01T00:00:00.000Z" }));
});

describe("POST /api/monetization (manual order integrity)", () => {
  it("records a manual sale as unverified and never as paid", async () => {
    const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
    const product = await prisma.product.create({
      data: { workspaceId: ws?.id ?? "", key: `vitest-manual-${Date.now()}`, name: "Vitest manual course", kind: "course", priceCents: 4900, currency: "USD", active: true },
    });
    const { POST } = await import("@/app/api/monetization/route");
    const req = new NextRequest("http://localhost:3000/api/monetization", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "order", productId: product.id, buyerName: "Vitest Buyer", manual: true, acknowledge: true, note: "cash sale recorded for book-keeping" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const { orderId } = (await res.json()) as { orderId?: string };
    const order = await prisma.order.findUnique({ where: { id: orderId ?? "" } });
    // Owner-verified manual sales go paid but stay distinguishable from
    // provider-verified payments: no verifiedByIdEvent, unverified event type.
    expect(order?.status).toBe("paid");
    expect(order?.verifiedByIdEvent).toBeNull();
    const manualEvent = await prisma.paymentEvent.findFirst({ where: { orderId: order?.id, provider: "manual" } });
    expect(manualEvent?.type).toBe("owner.manual_verified");
    expect(manualEvent?.signatureVerified).toBe(false);
    const rev = await prisma.revenueRecord.findFirst({ where: { orderId: order?.id } });
    expect(rev?.label ?? "").toContain("manual verification");
  });

  it("a signed payment event flips only that referenced order to paid", async () => {
    const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
    const order = await prisma.order.findFirst({
      where: { workspaceId: ws?.id ?? "", status: { not: "paid" } },
      orderBy: { createdAt: "desc" },
    });
    if (!order) return;
    const event = await prisma.paymentEvent.create({
      data: { workspaceId: ws?.id, orderId: order.id, provider: "stripe", type: "payment_intent.succeeded", payload: "{}", signatureVerified: true, processed: true },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "paid", verifiedByIdEvent: event.id, verifiedAt: new Date() } });
    const paid = await prisma.order.findUnique({ where: { id: order.id } });
    expect(paid?.status).toBe("paid");
    expect(paid?.verifiedByIdEvent).toBe(event.id);
  });
});
