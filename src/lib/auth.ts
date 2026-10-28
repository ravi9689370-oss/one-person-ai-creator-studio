import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

/**
 * When MOBILE_SYNC_ORIGIN is configured (the Android app syncs from its own
 * WebView origin), session cookies must be SameSite=None; Secure or the
 * browser/WebView drops them on cross-origin requests. The __Secure- /
 * __Host- prefixes are required alongside `secure: true`; therefore the
 * sync-enabled mode requires the server to run on https.
 * Unset (default) = unchanged same-site cookie behavior.
 */
function mobileSyncCookies(): NextAuthOptions["cookies"] {
  if (!process.env.MOBILE_SYNC_ORIGIN) return undefined;
  const opts = { httpOnly: true, sameSite: "none" as const, path: "/", secure: true };
  return {
    sessionToken: { name: "__Secure-next-auth.session-token", options: opts },
    callbackUrl: { name: "__Secure-next-auth.callback-url", options: opts },
    csrfToken: { name: "__Host-next-auth.csrf-token", options: opts },
    pkceCodeVerifier: { name: "__Secure-next-auth.pkce.code_verifier", options: opts },
    state: { name: "__Secure-next-auth.state", options: opts },
    nonce: { name: "__Secure-next-auth.nonce", options: opts },
  };
}

/**
 * Credentials-based authentication backed by hashed passwords in the
 * database. Sessions are JWTs signed server-side (NEXTAUTH_SECRET).
 * This is real session management, not a UI-level gate.
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  cookies: mobileSyncCookies(),
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, image: true, passwordHash: true },
        });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id ?? token.sub;
        const primary = await prisma.workspaceMember.findFirst({
          where: { userId: user.id as string },
          select: { workspaceId: true },
        });
        if (primary) token.workspaceId = primary.workspaceId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.sub as string;
        (session.user as { workspaceId?: string }).workspaceId = token.workspaceId as string;
      }
      return session;
    },
  },
};
