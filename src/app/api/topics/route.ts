import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody } from "@/server/api";

const list = z.object({});

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void list;
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const q = (searchParams.get("q") ?? "").trim();
  const items = await prisma.contentTopic.findMany({
    where: {
      workspaceId: auth.ctx.workspaceId,
      ...(status && status !== "all" ? { status } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { notes: { contains: q } }] } : {}),
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });
  return ok({ items });
}

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;
  const topic = await prisma.contentTopic.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      title: body.data.title,
      category: body.data.category || null,
      notes: body.data.notes || null,
      priority: body.data.priority,
    },
  });
  return ok({ id: topic.id }, { status: 201 });
}
