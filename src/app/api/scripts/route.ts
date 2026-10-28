import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody } from "@/server/api";

const listQuery = z.object({});

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void listQuery;
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Number(searchParams.get("pageSize") ?? 20));
  const search = (searchParams.get("q") ?? "").trim();
  const where = {
    workspaceId: auth.ctx.workspaceId,
    ...(search ? { OR: [{ title: { contains: search } }, { hook: { contains: search } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.script.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, title: true, format: true, platform: true, language: true, status: true, currentVersion: true, updatedAt: true, hook: true },
    }),
    prisma.script.count({ where }),
  ]);
  return ok({ items, total, page, pageSize });
}

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  format: z.enum(["long_form", "short_form", "outline", "sponsor_read"]).default("long_form"),
  platform: z.string().trim().min(2).max(40).default("youtube"),
  language: z.string().trim().min(2).max(8).default("en"),
  body: z.string().trim().min(1, "Script body is required.").max(40_000).optional(),
  hook: z.string().trim().max(300).optional(),
  tone: z.string().trim().max(120).optional(),
  targetMin: z.number().int().min(1).max(90).optional(),
  topicId: z.string().cuid().optional(),
  sponsorName: z.string().trim().max(120).optional(),
  sponsorTerms: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;

  if (body.data.topicId) {
    const topic = await prisma.contentTopic.findFirst({ where: { id: body.data.topicId, workspaceId: auth.ctx.workspaceId } });
    if (!topic) return fail(400, "invalid_topic", "Topic not found in this workspace.");
  }

  const script = await prisma.script.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      title: body.data.title,
      format: body.data.format,
      platform: body.data.platform,
      language: body.data.language,
      hook: body.data.hook ?? null,
      topicId: body.data.topicId ?? null,
      sponsorName: body.data.sponsorName ?? null,
      sponsorTerms: body.data.sponsorTerms ?? null,
      status: "draft",
      createdById: auth.ctx.userId,
    },
  });
  const version = await prisma.scriptVersion.create({
    data: {
      scriptId: script.id,
      version: 1,
      body: body.data.body ?? "",
      tone: body.data.tone ?? null,
      targetMin: body.data.targetMin ?? (body.data.format === "short_form" ? 1 : 8),
      createdById: auth.ctx.userId,
    },
  });
  await prisma.script.update({ where: { id: script.id }, data: { currentVersion: 1 } });
  void version;
  return ok({ id: script.id }, { status: 201 });
}
