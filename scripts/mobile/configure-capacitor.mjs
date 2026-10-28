#!/usr/bin/env node
/**
 * Prepares capacitor.config.json for `cap sync` from capacitor.config.ts.
 *
 * The mobile app is fully bundled (webDir www, built by build-www.mjs), so
 * there is no remote server.url, no allowNavigation and no bootstrap page
 * injection anymore — sync with the studio server is done in-app over fetch
 * (see src/middleware.ts for server-side CORS via MOBILE_SYNC_ORIGIN).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
let config = { appId: "com.creatorstudio.app", appName: "AI Creator Studio", webDir: "www" };

// Read app identity from capacitor.config.ts (regex — a TS module cannot be
// imported directly from a .mjs build script).
const tsConfig = path.join(root, "capacitor.config.ts");
if (existsSync(tsConfig)) {
  const ts = readFileSync(tsConfig, "utf8");
  const appIdMatch = /appId:\s*"([^"]+)"/.exec(ts);
  const appNameMatch = /appName:\s*"([^"]+)"/.exec(ts);
  const webDirMatch = /webDir:\s*"([^"]+)"/.exec(ts);
  config = {
    appId: appIdMatch?.[1] ?? "com.creatorstudio.app",
    appName: appNameMatch?.[1] ?? "AI Creator Studio",
    webDir: webDirMatch?.[1] ?? "www",
  };
}

const out = {
  ...config,
  android: { allowMixedContent: true },
};
const configPath = path.join(root, "capacitor.config.json");
writeFileSync(configPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`[configure-capacitor] wrote ${path.relative(root, configPath)} (webDir: ${config.webDir}, no remote server)`);
