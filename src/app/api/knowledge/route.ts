import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, readBody } from "@/server/api";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req.nextUrl;
  const items = await prisma.knowledgeDocument.findMany({
    where: { workspaceId: auth.ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, title: true, kind: true, content: true, assetId: true, updatedAt: true },
  });
  return ok({ items });
}

const createSchema = z.object({
  title: z.string().trim().min(2).max(160),
  kind: z.enum(["reference", "voice_note", "product", "faq"]).default("reference"),
  content: z.string().trim().max(60_000).default(""),
  assetId: z.string().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const body = await readBody(req, createSchema);
  if ("status" in body) return body as Response;
  if (body.data.assetId) {
    const a = await prisma.mediaAsset.findFirst({ where: { id: body.data.assetId, workspaceId: auth.ctx.workspaceId } });
    if (!a) return fail(400, "invalid_asset", "Asset not found.");
  }
  const doc = await prisma.knowledgeDocument.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      title: body.data.title,
      kind: body.data.kind,
      content: body.data.content,
      assetId: body.data.assetId || null,
      chunks: {
        create: chunkify(body.data.content).map((c, i) => ({ position: i, content: c })),
      },
    },
  });
  return ok({ id: doc.id }, { status: 201 });
}

/** naive chunking for retrieval; upgrade path documented in architecture docs */
function chunkify(text: string, chunkSize = 1200): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += chunkSize) {
    out.push(clean.slice(i, i + chunkSize));
  }
  return out;
}
