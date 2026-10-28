import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/authz";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export const metadata = { title: "Studio" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  let ctx;
  try {
    ctx = await requireSession({ session });
  } catch {
    redirect("/onboarding");
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId } });
  const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } });
  const unread = await prisma.notification.count({ where: { workspaceId: ctx.workspaceId, readAt: null, OR: [{ userId: null }, { userId: ctx.userId }] } });

  const schedule = await prisma.scheduledReport.findUnique({
    where: { workspaceId_kind: { workspaceId: ctx.workspaceId, kind: "morning_brief" } },
  });
  const hour = schedule?.hourLocal ?? 7;
  const briefTime = `${String(hour).padStart(2, "0")}:00 (${(workspace?.timezone ?? schedule?.timezone ?? "UTC").replace(/_/g, " ")})`;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          workspaceName={workspace?.name ?? "Workspace"}
          userName={user?.name ?? "Creator"}
          userEmail={user?.email ?? ""}
          unreadCount={unread}
          briefTime={briefTime}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
