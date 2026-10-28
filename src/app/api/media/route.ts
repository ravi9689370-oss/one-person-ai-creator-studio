/**
 * Media upload + library endpoints. Files are validated (type allowlist, size
 * caps), stored privately, and only served through the authenticated /raw
 * endpoint. Metadata is searchable/filterable.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";
import { checkUpload, putObject, newObjectKey } from "@/server/storage";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const { searchParams } = req.nextUrl;
  const kind = searchParams.get("kind");
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(60, Number(searchParams.get("pageSize") ?? 24));
  const where = {
    workspaceId: auth.ctx.workspaceId,
    ...(kind ? { kind } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { path: { contains: q } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, title: true, kind: true, mime: true, sizeBytes: true, path: true, source: true, createdAt: true, durationSec: true, transcript: true },
    }),
    prisma.mediaAsset.count({ where }),
  ]);
  return ok({ items, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "invalid_form", "multipart/form-data expected.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(422, "no_file", "A 'file' field is required.");
  const metaRaw = form.get("meta");
  let meta: Record<string, unknown> = {};
  if (typeof metaRaw === "string" && metaRaw) {
    try {
      meta = JSON.parse(metaRaw) as Record<string, unknown>;
    } catch {
      return fail(422, "invalid_meta", "meta must be JSON.");
    }
  }
  const check = checkUpload(file.type, file.size);
  if (!check.ok) return fail(422, "upload_rejected", check.reason);

  const buf = Buffer.from(await file.arrayBuffer());
  const key = newObjectKey(file.name, check.kind);
  const stored = await putObject(key, buf, auth.ctx.workspaceId);
  const title = typeof form.get("title") === "string" && (form.get("title") as string) ? (form.get("title") as string) : file.name;

  const asset = await prisma.mediaAsset.create({
    data: {
      workspaceId: auth.ctx.workspaceId,
      kind: check.kind,
      title: title.slice(0, 120),
      path: stored.path,
      mime: file.type,
      sizeBytes: stored.sizeBytes,
      durationSec: typeof meta.durationSec === "number" ? meta.durationSec : null,
      language: typeof meta.language === "string" ? meta.language : undefined,
      meta: JSON.stringify(meta),
      source: "upload",
      visibility: "private",
    },
  });
  await audit(auth.ctx, "media.upload", "media_asset", asset.id, { kind: check.kind, sizeBytes: stored.sizeBytes });
  return ok({ id: asset.id, sizeBytes: stored.sizeBytes }, { status: 201 });
}

const deleteSchema = z.object({});

export async function DELETE(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void deleteSchema;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail(422, "missing_id", "id query parameter required.");
  const existing = await prisma.mediaAsset.findFirst({ where: { id, workspaceId: auth.ctx.workspaceId } });
  if (!existing) return fail(404, "not_found", "Asset not found.");
  await prisma.mediaAsset.delete({ where: { id } });
  await audit(auth.ctx, "media.delete", "media_asset", id);
  return ok({ deleted: true });
}
