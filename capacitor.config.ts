import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Android shell.
 *
 * The Android app is a thin WebView client for the hosted web application -
 * it never ships business logic or secrets. The server URL is supplied at
 * build time via CREATOR_STUDIO_SERVER_URL (scripts/mobile/configure-capacitor
 * injects it and `cap sync android` writes it into the native assets).
 *
 * App id: com.creatorstudio.app (stable across local and CI builds).
 */
const rawUrl = process.env.CREATOR_STUDIO_SERVER_URL ?? "http://10.0.2.2:3000";
let server = { url: "http://10.0.2.2:3000", cleartext: true } as { url: string; cleartext?: boolean };
try {
  const parsed = new URL(rawUrl);
  server = {
    url: rawUrl,
    ...(parsed.protocol === "https:" ? {} : { cleartext: true }),
  };
} catch {
  // fall back to the Android-emulator loopback for production safety
}

const config: CapacitorConfig = {
  appId: "com.creatorstudio.app",
  appName: "Creator Studio",
  webDir: "public", // shell app: static assets only; real content is served remotely
  server,
};

export default config;
