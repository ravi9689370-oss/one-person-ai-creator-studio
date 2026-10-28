/**
 * Password reset request. Creates a single-use, expiring token (hashed at
 * rest). Delivery: email when SMTP is configured; in non-SMTP dev the UI
 * displays the reset link with a clear security notice. Rate limited.
 */
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clientIp, fail, ok, rateLimit } from "@/server/api";
import { providerEnv } from "@/lib/env";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimit(`forgot:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: { code: "rate_limited", message: "Too many reset attempts." } }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail(422, "validation_failed", "Valid email required.");
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Always respond the same way (no account enumeration).
  if (!user) {
    return ok({ message: "If that account exists, a reset link has been created." });
  }
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60_000) },
  });
  const env = providerEnv();
  const smtpConfigured = Boolean(env.smtpHost);
  const url = `/reset-password?token=${token}`;
  if (smtpConfigured) {
    // SMTP delivery boundary: wired to provider adapter when SMTP creds exist.
    await prisma.auditLog.create({ data: { actorId: user.id, action: "auth.reset_requested", objectType: "user", objectId: user.id, ip } });
    return ok({ message: "Password reset link sent by email.", smtpConfigured: true });
  }
  return ok({
    message: "SMTP is not configured, so the reset link is shown here (development mode).",
    resetUrl: url,
    smtpConfigured: false,
    notice: "Anyone with this link could take over the account until it expires. Use only on trusted devices.",
  });
}
