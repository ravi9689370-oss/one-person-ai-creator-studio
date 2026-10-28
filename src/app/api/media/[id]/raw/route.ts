/**
 * Authenticated media serving. Private storage tensors are never exposed
 * directly; every read requires a session + workspace match.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/server/api";
import { getObject } from "@/server/storage";

const MIME_FALLBACK = "application/octet-stream";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: params.id, workspaceId: auth.ctx.workspaceId },
    select: { path: true, mime: true },
  });
  if (!asset) return new Response("Not found", { status: 404 });
  const buf = await getObject(asset.path);
  if (!buf) return new Response("File missing from storage", { status: 410 });
  const ext = asset.path.split(".").pop() ?? "";
  let mime = asset.mime ?? MIME_FALLBACK;
  if (ext === "svg" && !mime.includes("svg")) mime = "image/svg+xml";
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": mime,
      "content-disposition": "inline",
      "cache-control": "private, max-age=3600",
    },
  });
}
