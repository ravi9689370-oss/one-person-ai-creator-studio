import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export type SessionCtx = {
  userId: string;
  email?: string | null;
  workspaceId: string;
  role: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/** Resolve the caller's session context for server code. Throws if unauthenticated. */
export async function requireSession(ctx: {
  session: { user?: { id?: string; email?: string | null } | null } | null;
}): Promise<SessionCtx> {
  const user = ctx.session?.user;
  if (!user?.id) throw new Error("UNAUTHENTICATED");
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) throw new Error("NO_WORKSPACE");
  return {
    userId: user.id,
    email: user.email ?? null,
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}

export function newIdempotencyKey(scope: string): string {
  return `${scope}:${crypto.randomUUID()}`;
}

export async function reserveIdempotencyKey(key: string, scope: string): Promise<boolean> {
  try {
    await prisma.idempotencyKey.create({ data: { key, scope } });
    return true;
  } catch {
    return false;
  }
}
