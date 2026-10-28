/**
 * Storage abstraction. Default adapter: local filesystem under STORAGE_DIR
 * with per-workspace prefixes. Files default to private; media is served only
 * through an authenticated download endpoint (no direct static serving).
 * A cloud adapter (S3/Supabase storage) can implement the same interface; see
 * docs/architecture.md#storage.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DEFAULT_STORAGE_DIR = path.join(process.cwd(), ".storage");

export function storageRoot(): string {
  return process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : DEFAULT_STORAGE_DIR;
}

function safeKey(key: string): string {
  // Reject traversal and control chars; keep the key relative.
  const cleaned = key.replace(/\\/g, "/").replace(/\.\.+/g, "").replace(/[\u0000-\u001f]/g, "");
  if (cleaned.startsWith("/")) return safeKey(cleaned.slice(1));
  if (cleaned === "") throw new Error("Empty storage key");
  return cleaned;
}

export async function putObject(key: string, data: Buffer, workspaceId: string): Promise<{ path: string; key: string; sizeBytes: number }> {
  const rel = safeKey(`${workspaceId}/${key}`);
  const abs = path.join(storageRoot(), rel);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, data);
  return { path: rel, key: rel, sizeBytes: data.length };
}

export async function getObject(relPath: string): Promise<Buffer | null> {
  const rel = safeKey(relPath);
  const abs = path.join(storageRoot(), rel);
  if (!abs.startsWith(storageRoot())) return null; // traversal guard
  try {
    return await fsp.readFile(abs);
  } catch {
    return null;
  }
}

export function newObjectKey(originalName: string, kind: string): string {
  const ext = path.extname(originalName || "").slice(0, 10) || "";
  const base = path.basename(originalName || "file", ext).replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 40) || "file";
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const id = crypto.randomBytes(6).toString("hex");
  return `${kind}/${ym}/${id}-${base}${ext}`;
}

const ALLOWED_UPLOAD_KINDS: Record<string, string[]> = {
  audio: ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg"],
  image: ["image/png", "image/jpeg", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  document: ["text/plain", "application/pdf", "text/markdown", "application/json"],
};

export type UploadCheck = { ok: true; kind: string } | { ok: false; reason: string };

/** Validates upload type + size against an allowlist. Max sizes per kind. */
export function checkUpload(mime: string | null | undefined, sizeBytes: number): UploadCheck {
  const MAX = { audio: 60 * 1024 * 1024, image: 10 * 1024 * 1024, video: 300 * 1024 * 1024, document: 20 * 1024 * 1024 } as const;
  const m = (mime || "").toLowerCase();
  for (const [kind, list] of Object.entries(ALLOWED_UPLOAD_KINDS)) {
    if (list.includes(m)) {
      const max = MAX[kind as keyof typeof MAX];
      if (sizeBytes > max) return { ok: false, reason: `File exceeds the ${Math.round(max / (1024 * 1024))} MB limit for ${kind}.` };
      return { ok: true, kind };
    }
  }
  return { ok: false, reason: "Unsupported file type." };
}

export function storageOperational(): boolean {
  let ok = true;
  try {
    fs.accessSync(storageRoot(), fs.constants.W_OK);
  } catch {
    try {
      fs.mkdirSync(storageRoot(), { recursive: true });
    } catch {
      ok = false;
    }
  }
  return ok;
}
