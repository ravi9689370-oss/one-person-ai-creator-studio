import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail } from "@/server/api";
import { refreshIntegrationStatuses } from "@/server/integrations";

export async function GET(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  void req;
  await refreshIntegrationStatuses(auth.ctx.workspaceId);
  const items = await prisma.integration.findMany({
    where: { workspaceId: auth.ctx.workspaceId },
    orderBy: [{ category: "asc" }, { providerKey: "asc" }],
  });
  return ok({ items });
}

const patchSchema = z.object({
  providerKey: z.string().trim().min(2).max(60),
  capabilityNotes: z.string().trim().max(2000).optional(),
});

/** Manual notes update only - statuses derive from config detection + verification events. */
export async function PATCH(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid payload.");
  await refreshIntegrationStatuses(auth.ctx.workspaceId);
  const item = await prisma.integration.findUnique({
    where: { workspaceId_providerKey: { workspaceId: auth.ctx.workspaceId, providerKey: parsed.data.providerKey } },
  });
  if (!item) return fail(404, "not_found", "Integration not registered.");
  const updated = await prisma.integration.update({
    where: { id: item.id },
    data: parsed.data.capabilityNotes !== undefined ? { capabilityNotes: parsed.data.capabilityNotes } : {},
  });
  return ok({ integration: updated });
}
