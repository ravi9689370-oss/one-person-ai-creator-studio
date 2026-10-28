import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Android shell.
 *
 * The app boots a LOCAL branded bootstrap page (public/index.html) which:
 *  - fetches the studio server once per boot (URL injected at build time),
 *  - auto-navigates into the web app when reachable,
 *  - shows a branded, actionable screen (never a white page) when the server
 *    is unreachable (real device before `adb reverse`, dev server off, etc.).
 *
 * The server URL lives in the bootstrap page — scripts/mobile/configure-
 * capacitor.mjs rewrites its SERVER_URL assignment from
 * CREATOR_STUDIO_SERVER_URL (default http://10.0.2.2:3000 for the emulator).
 *
 * allowNavigation permits in-WebView navigation to the studio origin;
 * without it Capacitor would open the studio in the external browser.
 */
const config: CapacitorConfig = {
  appId: "com.creatorstudio.app",
  appName: "AI Creator Studio",
  webDir: "public", // local bootstrap; product UI is served by the studio server
  android: {
    allowMixedContent: true, // dev servers run on http (https in production)
  },
  server: {
    allowNavigation: ["*"], // studio host injected via the bootstrap URL
  },
};

export default config;
