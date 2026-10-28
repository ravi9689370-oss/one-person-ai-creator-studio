import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody } from "@/server/api";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  const items = await prisma.styleGuide.findMany({
    where: { workspaceId: auth.ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  return ok({ items });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  platform: z.string().trim().max(40).optional().or(z.literal("")),
  rules: z.string().trim().min(1).max(20_000),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;
  const guide = await prisma.styleGuide.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      name: body.data.name,
      platform: body.data.platform || null,
      rules: body.data.rules,
    },
  });
  return ok({ id: guide.id }, { status: 201 });
}
