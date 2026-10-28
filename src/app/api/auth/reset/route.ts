import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { audit, clientIp, fail, ok, rateLimit } from "@/server/api";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimit(`reset:${ip}`, 8, 60_000)) return fail(429, "rate_limited", "Too many attempts.");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail(422, "validation_failed", "Token and a valid password are required.", {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return fail(400, "invalid_token", "Reset link is invalid, used, or expired.");
  }
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) } }),
  ]);
  await audit({ userId: row.userId, workspaceId: "", role: "member" }, "auth.password_reset", "user", row.userId, undefined, ip);
  return ok({ message: "Password updated. You can sign in now." });
}
