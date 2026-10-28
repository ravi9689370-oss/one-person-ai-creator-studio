import { NextRequest, NextResponse } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";

/**
 * Two jobs, composed:
 *
 * 1. Auth protection (unchanged behavior): only auth pages + public API
 *    endpoints are reachable without a session.
 *
 * 2. Opt-in CORS for the mobile app (Android APK). The offline-first mobile
 *    SPA (mobile-app/ → www/) syncs with this server over fetch from the
 *    app's own WebView origin. Browsers/WebViews block such cross-origin
 *    calls unless this server explicitly allows them, so CORS is enabled
 *    ONLY when MOBILE_SYNC_ORIGIN is configured (single origin or a
 *    comma-separated list), and ONLY for requests whose Origin matches.
 *    Unset (the default) = zero behavior change for same-origin users.
 */

const PUBLIC_PATH_PREFIXES = [
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/api/health",
  "/api/authz",
];

const PUBLIC_PAGES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
];

function allowedOrigins(): string[] {
  return (process.env.MOBILE_SYNC_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function corsHeadersFor(req: NextRequest): Record<string, string> | null {
  const origins = allowedOrigins();
  if (!origins.length) return null;
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const normalized = origin.replace(/\/+$/, "");
  if (!origins.includes(normalized)) return null;
  return {
    "Access-Control-Allow-Origin": normalized,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (pathname === "/favicon.ico" || pathname === "/icon.svg" || pathname === "/robots.txt") return true;
  return false;
}

export default function middleware(req: NextRequest) {
  const cors = corsHeadersFor(req);

  // CORS preflight: must never hit auth or be redirected.
  if (req.method === "OPTIONS") {
    if (!cors) return NextResponse.next(); // no CORS configured — pass through (handlers answer 405)
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...cors,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const pathname = req.nextUrl.pathname;
  // withAuth's exported signature wants NextRequestWithAuth; at runtime a
  // plain NextRequest works (it only attaches `nextauth` for route handlers).
  const res = isPublic(pathname)
    ? NextResponse.next()
    : (withAuth(req as NextRequestWithAuth, {
        pages: { signIn: "/login" },
        callbacks: { authorized: ({ token }) => token !== null },
      }) as NextResponse);

  if (cors) {
    for (const [key, value] of Object.entries(cors)) res.headers.set(key, value);
  }
  return res;
}

export const config = {
  // Everything except immutable Next assets — CORS must apply to /api/auth/*
  // too (csrf/session/callback), so this matcher is wider than the auth
  // matcher; per-request decisions happen in middleware() above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
