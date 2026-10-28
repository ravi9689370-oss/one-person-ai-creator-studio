// @vitest-environment jsdom
/**
 * Offline-first mobile SPA smoke tests.
 *
 * Boots the REAL app (mobile-app/ — the same code bundled into the Android
 * APK) inside jsdom and renders every route, asserting no blank screens and
 * that key honest-content markers exist. jsdom has no IndexedDB, so this
 * also exercises the localStorage fallback path (the same path a degraded
 * WebView would take). Also verifies the www build script that feeds the
 * APK packaging.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");

async function waitPageReady(marker?: string): Promise<void> {
  await vi.waitFor(
    () => {
      const pageRoot = document.getElementById("pageRoot");
      expect(pageRoot?.children.length ?? 0).toBeGreaterThan(0);
      const skeletons = pageRoot?.querySelectorAll(".skeleton").length ?? 0;
      expect(skeletons).toBe(0);
      if (marker) {
        expect(document.body.textContent ?? "").toContain(marker);
      }
    },
    { timeout: 8000, interval: 60 },
  );
}

async function navigate(hash: string, marker: string): Promise<void> {
  window.location.hash = hash;
  window.dispatchEvent(new Event("hashchange"));
  await waitPageReady(marker);
}

beforeAll(async () => {
  // jsdom gaps the WebView does have — stub before the app module loads
  // (main.js touches matchMedia at import time).
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  window.scrollTo = () => {};

  document.body.innerHTML = `<div id="app" class="app-shell"></div>`;
  await import("../mobile-app/assets/js/main.js");
  await waitPageReady();
});

describe("mobile SPA (offline-first)", () => {
  it("boots the shell with topbar, tabs and dashboard (no blank screen)", () => {
    expect(document.querySelector(".topbar .brand")?.textContent).toContain("AI Creator Studio");
    expect(document.querySelectorAll("#tabbar .tab").length).toBe(5);
    expect(document.body.textContent).toContain("Revenue (this month)");
    expect(document.body.textContent).toContain("Pipeline");
    expect(document.body.textContent).toContain("stored on-device");
  });

  it("renders the Script Studio list and editor", async () => {
    await navigate("#/scripts", "Workspace scripts");
    const raw = window.localStorage.getItem("ai-creator-studio:scripts");
    const scripts = raw ? (JSON.parse(raw) as Array<{ id: string }>) : [];
    expect(scripts.length).toBeGreaterThan(0);
    await navigate(`#/scripts/${scripts[0].id}`, "Maya assist");
    const title = document.querySelector("#sc-title") as HTMLInputElement | null;
    expect(title?.value?.length ?? 0).toBeGreaterThan(0);
  });

  it("renders the Maya chat with honest AI labeling", async () => {
    await navigate("#/maya", "Maya · AI (offline)");
    expect(document.body.textContent).toContain("offline assistant");
  });

  it("renders the Publishing Hub", async () => {
    await navigate("#/publishing", "Platform queues");
    expect(document.body.textContent).toContain("Schedule a post");
  });

  it("renders Monetization & Analytics", async () => {
    await navigate("#/monetization", "Record an earning");
    expect(document.body.textContent).toContain("This month");
    expect(document.body.textContent).toContain("local ledger");
  });

  it("renders Settings with optional-sync honesty", async () => {
    await navigate("#/settings", "Studio server sync (optional)");
    expect(document.body.textContent).toContain("Reset workspace");
  });

  it("unknown routes get a friendly page, not a blank screen", async () => {
    await navigate("#/does-not-exist", "Page not found");
    expect(document.body.textContent).toContain("Back to Dashboard");
  });

  it("never references the old remote-server boot failure", () => {
    expect(document.body.textContent).not.toContain("Could not reach server");
  });
});

describe("offline Maya engine (pure functions)", () => {
  it("answers a hooks request with 5 numbered hooks", async () => {
    const { answer } = await import("../mobile-app/assets/js/maya.js");
    const r = answer("give me hooks for my faceless channel", { topTopic: "Faceless channels" });
    expect(r.text).toMatch(/1\./);
    expect(r.text.match(/^\d+\./gm)?.length).toBe(5);
  });

  it("labels itself and refuses to pretend to be a cloud model", async () => {
    const { answer, disclaimerLine } = await import("../mobile-app/assets/js/maya.js");
    expect(disclaimerLine()).toContain("offline assistant");
    const r = answer("what can you do", {});
    expect(r.text).toContain("fully offline");
  });
});

describe("store.js localStorage fallback (IndexedDB unavailable)", () => {
  it("persists settings and records through the fallback path", async () => {
    const store = await import("../mobile-app/assets/js/store.js");
    await store.setSetting("smoke-test-key", { ok: true });
    const back = await store.getSetting("smoke-test-key", null);
    expect(back).toEqual({ ok: true });
    const rows = await store.getAll("scripts");
    expect(rows.length).toBeGreaterThan(0); // seeded sample workspace
  });
});

describe("www build (feeds the Android APK)", () => {
  it("builds www/ with the server URL injected and no leftover token", () => {
    execSync("node scripts/mobile/build-www.mjs", { cwd: root, stdio: "pipe" });
    expect(existsSync(path.join(root, "www", "index.html"))).toBe(true);
    expect(existsSync(path.join(root, "www", "assets", "css", "app.css"))).toBe(true);
    for (const f of ["main", "store", "ui", "charts", "maya", "sync"]) {
      expect(existsSync(path.join(root, "www", "assets", "js", `${f}.js`))).toBe(true);
    }
    for (const f of ["dashboard", "scripts", "maya", "publishing", "monetization", "settings"]) {
      expect(existsSync(path.join(root, "www", "assets", "js", "views", `${f}.js`))).toBe(true);
    }
    const syncJs = readFileSync(path.join(root, "www", "assets", "js", "sync.js"), "utf8");
    expect(syncJs).toContain("http://10.0.2.2:3000"); // default injected URL
    expect(syncJs).not.toContain("__SERVER_URL__");
    const html = readFileSync(path.join(root, "www", "index.html"), "utf8");
    expect(html).toContain("assets/js/main.js");
  });
});
