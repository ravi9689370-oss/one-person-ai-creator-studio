import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody } from "@/server/api";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const items = await prisma.calendarItem.findMany({
    where: {
      workspaceId: auth.ctx.workspaceId,
      ...(from || to
        ? {
            scheduledFor: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { scheduledFor: "asc" },
    take: 300,
  });
  return ok({ items });
}

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  channel: z.string().trim().max(40).optional().or(z.literal("")),
  scheduledFor: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  topicId: z.string().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;
  if (body.data.topicId) {
    const t = await prisma.contentTopic.findFirst({ where: { id: body.data.topicId, workspaceId: auth.ctx.workspaceId } });
    if (!t) return fail(400, "invalid_topic", "Topic not found.");
  }
  const item = await prisma.calendarItem.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      title: body.data.title,
      channel: body.data.channel || null,
      scheduledFor: body.data.scheduledFor ? new Date(body.data.scheduledFor) : null,
      notes: body.data.notes || null,
      topicId: body.data.topicId || null,
    },
  });
  return ok({ id: item.id }, { status: 201 });
}
