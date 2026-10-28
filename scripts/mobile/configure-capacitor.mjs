#!/usr/bin/env node
/**
 * Prepares the Capacitor Android configuration from environment inputs.
 *
 * - Reads CREATOR_STUDIO_SERVER_URL (the URL the Android WebView should reach).
 * - Normalizes and validates it.
 * - Writes capacitor.config.json for `cap sync` (no remote server.url: the
 *   app boots the local bootstrap page in public/index.html and auto-navigates
 *   to the server, so a dead server can never leave a white screen).
 * - Injects the URL into public/index.html's SERVER_URL assignment.
 * - Ensures a webDir exists so `cap sync` passes without a bundler run.
 *
 * Run before `npx cap sync android` (npm run cap:sync does both).
 * Locally unset CREATOR_STUDIO_SERVER_URL means the Android emulator can
 * reach the dev server on http://10.0.2.2:3000.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
let config = { appId: "com.creatorstudio.app", appName: "AI Creator Studio", webDir: "public" };

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

const out = {
  ...config,
  android: { allowMixedContent: true },
  server: { allowNavigation: ["*"] },
};
const configPath = path.join(root, "capacitor.config.json");
writeFileSync(configPath, `${JSON.stringify(out, null, 2)}\n`);

/* Inject the server URL into the bootstrap page (public/index.html). */
const bootstrap = path.join(root, config.webDir ?? "public", "index.html");
if (existsSync(bootstrap)) {
  const html = readFileSync(bootstrap, "utf8");
  const targetAssignment = `var SERVER_URL = ${JSON.stringify(serverUrl)}`;
  if (html.includes(targetAssignment)) {
    console.log(`[configure-capacitor] bootstrap server URL already up to date (${serverUrl})`);
  } else {
    const replaced = html.replace(/var SERVER_URL = "[^"]*"/, targetAssignment);
    if (replaced === html) {
      console.warn("[configure-capacitor] no SERVER_URL assignment found in the bootstrap page — check public/index.html");
    } else {
      writeFileSync(bootstrap, replaced);
      console.log(`[configure-capacitor] injected ${serverUrl} into ${path.relative(root, bootstrap)}`);
    }
  }
} else {
  console.warn("[configure-capacitor] bootstrap page missing — the shell would boot empty; expected public/index.html");
}

// Ensure a webDir exists so `cap sync` passes without a bundler run.
const webDirPath = path.join(root, config.webDir ?? "public");
if (!existsSync(webDirPath)) mkdirSync(webDirPath, { recursive: true });

console.log(`[configure-capacitor] bootstrap server URL: ${serverUrl}`);
console.log(`[configure-capacitor] wrote ${path.relative(root, configPath)}`);
