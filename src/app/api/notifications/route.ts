import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail } from "@/server/api";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const type = req.nextUrl.searchParams.get("type");
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get("limit") ?? 15));
  const notifications = await prisma.notification.findMany({
    where: { workspaceId: auth.ctx.workspaceId, OR: [{ userId: null }, { userId: auth.ctx.userId }] },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, title: true, body: true, link: true, type: true, readAt: true, createdAt: true },
  });
  void type;
  return ok({ items: notifications, unread: notifications.filter((n) => !n.readAt).length });
}

const markReadSchema = z.object({
  ids: z.array(z.string()).max(100).optional(),
  all: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const parsed = markReadSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid body.");
  await prisma.notification.updateMany({
    where: {
      workspaceId: auth.ctx.workspaceId,
      readAt: null,
      OR: [{ userId: null }, { userId: auth.ctx.userId }],
      ...(parsed.data.all ? {} : { id: { in: parsed.data.ids ?? [] } }),
    },
    data: { readAt: new Date() },
  });
  return ok({ ok: true });
}
