/** Workspace onboarding: creates the workspace with its full scaffolding. */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createWorkspace } from "@/server/workspace";
import { audit, clientIp, fail, ok, rateLimit } from "@/server/api";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  timezone: z.string().trim().min(1).max(60).default("UTC"),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return fail(401, "unauthenticated", "Authentication required.");

  const existing = await prisma.workspaceMember.findFirst({ where: { userId } });
  if (existing) return fail(409, "already_in_workspace", "This account already belongs to a workspace.");

  const ip = clientIp(req);
  const limited = rateLimit(`onboarding:${userId}`, 6, 60_000);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail(422, "validation_failed", "Workspace name is required.", {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const { workspaceId } = await createWorkspace({
    name: parsed.data.name,
    timezone: parsed.data.timezone,
    userId,
  });
  await audit({ userId, workspaceId, role: "owner" }, "workspace.create", "workspace", workspaceId, { name: parsed.data.name }, ip);
  return ok({ workspaceId }, { status: 201 });
}
