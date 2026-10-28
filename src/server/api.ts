import { z } from "zod";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSession, type SessionCtx } from "@/lib/authz";
import { prisma } from "@/lib/db";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Json = unknown;

export function ok(data: Json, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function fail(status: number, code: string, message: string, extra?: Json): Response {
  return Response.json({ error: { code, message, ...(extra as object | undefined) } }, { status });
}

/** Authenticated context for a request; validates the session server-side. */
export async function withAuth(req: NextRequest): Promise<{ ctx: SessionCtx } | Response> {
  const session = await getServerSession(authOptions);
  try {
    const ctx = await requireSession({ session });
    return { ctx };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "NO_WORKSPACE") return fail(403, "no_workspace", "No workspace for this account.");
    return fail(401, "unauthenticated", "Authentication required.");
  }
}

/** Parse and validate JSON body with a zod schema. Enforces a request-size limit. */
export async function readBody<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S
): Promise<{ data: z.infer<S> } | Response> {
  const maxBytes = 10 * 1024 * 1024; // 10 MB per API request
  const len = req.headers.get("content-length");
  if (len && Number(len) > maxBytes) {
    return fail(413, "payload_too_large", "Request body exceeds the size limit.");
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "invalid_json", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return fail(422, "validation_failed", "Invalid input.", {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return { data: parsed.data };
}

/** Basic in-memory rate limiter keyed by user/route (per-process; ops guide covers production limiter). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): Response | null {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  b.count += 1;
  if (b.count > limit) {
    return fail(429, "rate_limited", "Too many requests. Try again shortly.");
  }
  return null;
}

/** Audit helper - never record secrets or full customer payloads here. */
export async function audit(
  ctx: SessionCtx | null,
  action: string,
  objectType: string,
  objectId?: string | null,
  meta?: Record<string, unknown> | null,
  ip?: string
) {
  await prisma.auditLog.create({
    data: {
      workspaceId: ctx?.workspaceId ?? null,
      actorId: ctx?.userId ?? null,
      action,
      objectType,
      objectId: objectId ?? null,
      meta: meta ? JSON.stringify(meta).slice(0, 4000) : undefined,
      ip: ip ?? null,
    },
  });
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() ?? "";
}
