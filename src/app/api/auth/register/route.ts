import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { clientIp, fail, ok, rateLimit } from "@/server/api";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().trim().min(1).max(80),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`register:${ip}`, 10, 60_000);
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "invalid_json", "Invalid JSON body.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return fail(422, "validation_failed", "Invalid input.", {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return fail(409, "email_taken", "An account with that email already exists.");

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
    },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "auth.register", objectType: "user", objectId: user.id, ip },
  });
  return ok({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
}
