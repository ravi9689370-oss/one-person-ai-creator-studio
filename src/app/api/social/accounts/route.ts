import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth, ok, fail, audit } from "@/server/api";

/** Register / update a platform account record. Status remains explicit. */
export async function POST(req: NextRequest) {
  const auth = await withAuth(req);
  if ("status" in auth) return auth;
  const raw = await req.json().catch(() => null);
  const schema = z.object({
    platform: z.enum(["youtube", "tiktok", "instagram", "facebook", "linkedin", "substack", "spotify"]),
    handle: z.string().trim().max(80).optional().or(z.literal("")),
    status: z.enum(["connected", "awaiting_authorization", "disconnected"]).default("awaiting_authorization"),
  });
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) return fail(422, "validation_failed", "Invalid payload.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });

  // Account connection realness: only mark connected after a verified adapter
  // operation; manual claims just record the requested authorization state.
  const data = {
    platform: parsed.data.platform,
    handle: parsed.data.handle || null,
    status: parsed.data.status === "connected" ? "awaiting_authorization" : parsed.data.status, // never self-assert connected
  };
  const account = await prisma.socialAccount.upsert({
    where: { workspaceId_platform: { workspaceId: auth.ctx.workspaceId, platform: parsed.data.platform } },
    create: { workspaceId: auth.ctx.workspaceId, ...data, status: "awaiting_authorization" },
    update: { handle: data.handle, status: "awaiting_authorization" },
  });
  void data.status;
  await audit(auth.ctx, "social.account.registered", "social_account", account.id, { platform: parsed.data.platform });
  return ok({ account, note: "Status is 'awaiting_authorization' until the platform OAuth flow is completed and verified." }, { status: 201 });
}
