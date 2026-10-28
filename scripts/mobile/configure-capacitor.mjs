#!/usr/bin/env node
/**
 * Prepares the Capacitor Android configuration from environment inputs.
 *
 * - Reads CREATOR_STUDIO_SERVER_URL (the URL the Android WebView should load).
 * - Normalizes android: scheme and writes capacitor.config.json for `cap sync`.
 *
 * Run before `npx cap sync android` (npm run cap:sync does both).
 * In CI the default CREATOR_STUDIO_SERVER_URL points to your deployed origin;
 * locally unset means the Android emulator can reach the dev server on 10.0.2.2:3000.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
let config = { appId: "com.creatorstudio.app", appName: "Creator Studio", webDir: "public" };

// Read app identity from capacitor.config.ts (regex - a TS module cannot be
// imported directly from a .mjs build script).
const tsConfig = path.join(root, "capacitor.config.ts");
if (existsSync(tsConfig)) {
  const ts = readFileSync(tsConfig, "utf8");
  const urlMatch = /CREATOR_STUDIO_SERVER_URL\]?\s*\?\?\s*"([^"]+)"/.exec(ts);
  const appIdMatch = /appId:\s*"([^"]+)"/.exec(ts);
  const appNameMatch = /appName:\s*"([^"]+)"/.exec(ts);
  const webDirMatch = /webDir:\s*"([^"]+)"/.exec(ts);
  config = {
    appId: appIdMatch?.[1] ?? "com.creatorstudio.app",
    appName: appNameMatch?.[1] ?? "Creator Studio",
    webDir: webDirMatch?.[1] ?? "public",
  };
}

const raw = process.env.CREATOR_STUDIO_SERVER_URL ?? "";
let serverUrl = "";
if (raw) {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") serverUrl = raw;
  } catch {
    console.warn(`[configure-capacitor] CREATOR_STUDIO_SERVER_URL is not a valid URL ("${raw}"); ignoring.`);
  }
}
if (!serverUrl) {
  // Android emulator loopback: host dev server on port 3000.
  serverUrl = "http://10.0.2.2:3000";
}

let server = { url: serverUrl };
if (new URL(serverUrl).protocol === "http:") server.cleartext = true;

const out = { ...config, server };
const configPath = path.join(root, "capacitor.config.json");
writeFileSync(configPath, `${JSON.stringify(out, null, 2)}\n`);

// Ensure a webDir exists so `cap sync` passes without a bundler run.
const webDirPath = path.join(root, config.webDir ?? "public");
if (!existsSync(webDirPath)) mkdirSync(webDirPath, { recursive: true });

console.log(`[configure-capacitor] server URL: ${serverUrl}`);
console.log(`[configure-capacitor] wrote ${path.relative(root, configPath)}`);
