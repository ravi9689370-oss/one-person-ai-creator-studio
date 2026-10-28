#!/usr/bin/env node
/**
 * build-www.mjs — builds the offline-first mobile web app into webDir ("www").
 *
 * The mobile app is a dependency-free vanilla ES-module SPA in mobile-app/.
 * This script:
 *  1. wipes + recreates webDir,
 *  2. copies mobile-app/ verbatim (index.html, assets/**),
 *  3. injects the studio server URL into assets/js/sync.js by replacing the
 *     __SERVER_URL__ token (source of truth: CREATOR_STUDIO_SERVER_URL,
 *     default http://10.0.2.2:3000 for the Android emulator).
 *
 * If the URL is unset, the token is replaced with "" and the app reports
 * "no server configured" and stays fully offline — never an error loop.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const src = path.join(root, "mobile-app");
const webDir = path.join(root, "www");

function readWebDirFromTsConfig() {
  const tsConfig = path.join(root, "capacitor.config.ts");
  if (!existsSync(tsConfig)) return "www";
  const m = /webDir:\s*"([^"]+)"/.exec(readFileSync(tsConfig, "utf8"));
  return m?.[1] ?? "www";
}

const webDirName = readWebDirFromTsConfig();
const webDirPath = webDirName === "www" ? webDir : path.join(root, webDirName);

if (!existsSync(src)) {
  console.error(`[build-www] source directory missing: ${path.relative(root, src)}`);
  process.exit(1);
}

/* 1. clean output */
rmSync(webDirPath, { recursive: true, force: true });
mkdirSync(webDirPath, { recursive: true });

/* 2. copy the SPA verbatim */
cpSync(src, webDirPath, { recursive: true });

/* 3. inject server URL into the copied sync.js */
function normalizeUrl(raw) {
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? raw.replace(/\/+$/, "") : "";
  } catch {
    return "";
  }
}

const envUrl = normalizeUrl(process.env.CREATOR_STUDIO_SERVER_URL);
const serverUrl = envUrl || "http://10.0.2.2:3000"; // emulator loopback default

const syncTarget = path.join(webDirPath, "assets", "js", "sync.js");
if (!existsSync(syncTarget)) {
  console.error("[build-www] assets/js/sync.js missing after copy — check mobile-app/");
  process.exit(1);
}
const before = readFileSync(syncTarget, "utf8");
const token = "__SERVER_URL__";
if (!before.includes(token)) {
  console.warn("[build-www] no __SERVER_URL__ token found in sync.js — nothing injected");
} else {
  const after = before.replace(token, serverUrl);
  writeFileSync(syncTarget, after);
  console.log(`[build-www] injected server URL into assets/js/sync.js: ${serverUrl}`);
}

/* sanity: the built SPA must have an entry point and every module present */
const required = [
  "index.html",
  "assets/css/app.css",
  "assets/js/main.js",
  "assets/js/store.js",
  "assets/js/ui.js",
  "assets/js/charts.js",
  "assets/js/maya.js",
  "assets/js/sync.js",
  "assets/js/views/dashboard.js",
  "assets/js/views/scripts.js",
  "assets/js/views/maya.js",
  "assets/js/views/publishing.js",
  "assets/js/views/monetization.js",
  "assets/js/views/settings.js",
];
const missing = required.filter((rel) => !existsSync(path.join(webDirPath, rel)));
if (missing.length) {
  console.error(`[build-www] build incomplete, missing: ${missing.join(", ")}`);
  process.exit(1);
}

function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}
console.log(`[build-www] webDir "${webDirName}" built: ${countFiles(webDirPath)} files`);
