import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSession, type SessionCtx } from "@/lib/authz";

/**
 * Resolve the viewer's session context for server-rendered pages.
 * Unauthenticated -> /login; workspaceless -> /onboarding.
 */
export async function pageCtx(): Promise<SessionCtx> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  try {
    return await requireSession({ session });
  } catch {
    redirect("/onboarding");
  }
}
