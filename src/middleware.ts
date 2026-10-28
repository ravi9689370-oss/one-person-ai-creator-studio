import { withAuth } from "next-auth/middleware";

/**
 * Server-side route protection: only auth pages + public API endpoints are
 * reachable without a session. This is real protection, not a UI gate.
 */
export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ token }) => token !== null,
  },
});

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|onboarding|api/auth|api/webhooks|api/cron|api/health|api/authz|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
  ],
};
