import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit, readBody, rateLimit } from "@/server/api";

const createSchema = z.object({
  objectType: z.enum(["script", "voice", "video", "localization", "thumbnail", "post", "sale", "product", "expense"]),
  objectId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  context: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const { ctx } = auth;
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const objectType = req.nextUrl.searchParams.get("objectType");
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Number(req.nextUrl.searchParams.get("pageSize") ?? 20));

  const where = {
    workspaceId: ctx.workspaceId,
    ...(status === "all" ? {} : { status }),
    ...(objectType ? { objectType } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, objectType: true, objectId: true, title: true, status: true, context: true, createdAt: true, decidedAt: true, decidedById: true, decisionNote: true },
    }),
    prisma.approvalRequest.count({ where }),
  ]);
  return ok({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const { ctx } = auth;
  if (rateLimit(`approvals-create:${ctx.userId}`, 20, 60_000)) return fail(429, "rate_limited", "Slow down.");

  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;

  const requestId = Date.now();
  void requestId;
  const { createApprovalRequest } = await import("@/server/approvals");
  const request = await createApprovalRequest(ctx.workspaceId, {
    objectType: body.data.objectType,
    objectId: body.data.objectId,
    title: body.data.title,
    context: body.data.context,
    requestedById: ctx.userId,
  });
  await audit(ctx, "approval.create", body.data.objectType, body.data.objectId, { approvalId: request.id });
  return ok({ id: request.id }, { status: 201 });
}
