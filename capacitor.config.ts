import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Android app.
 *
 * Architecture: the APK is a STANDALONE offline-first app. The full SPA
 * (every page, asset and route) is bundled locally:
 *
 *   mobile-app/            — source of truth (vanilla ES-module SPA)
 *   www/                   — built by scripts/mobile/build-www.mjs
 *   android/app/src/main/assets/public — copied by `cap sync`
 *
 * The app boots from local assets with NO remote server dependency, so a
 * dead/unreachable server can never leave a white screen. Data lives in
 * IndexedDB; syncing with the studio server is optional and configured in
 * the app's Settings screen (fetch-based, needs server-side CORS via
 * MOBILE_SYNC_ORIGIN — see src/middleware.ts).
 *
 * android.allowMixedContent only matters if a user configures an http://
 * dev-server URL for sync testing; production sync targets are https.
 */
const config: CapacitorConfig = {
  appId: "com.creatorstudio.app",
  appName: "AI Creator Studio",
  webDir: "www", // built from mobile-app/ by `npm run mobile:build`
  android: {
    allowMixedContent: true,
  },
};

export default config;
