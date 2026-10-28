/**
 * views/settings.js — profile, theme, server sync (optional), data
 * export/import, demo reset, about. Every control works locally; sync is
 * opt-in and reports failures honestly (no silent no-ops).
 */

import { getAll, getSetting, setSetting, clearAllStores, ensureSeeded, SEED_VERSION } from "../store.js";
import { h, card, chip, toast, confirmModal, downloadText, banner, money } from "../ui.js";
import { applyTheme, navigate } from "../main.js";
import { getSyncConfig, normalize, ping, login, sessionInfo, pullBrief, pushAllUnsynced } from "../sync.js";

function sectionTitle(text) {
  return h("div", { class: "section-title" }, text);
}

async function countRecords() {
  const stores = ["scripts", "posts", "revenue", "sponsors", "maya", "topics", "metrics"];
  const all = await Promise.all(stores.map((s) => getAll(s)));
  return stores.map((s, i) => ({ store: s, count: all[i].length }));
}

export async function render() {
  const [profile, theme, cfg, counts, lastBrief] = await Promise.all([
    getSetting("profile", { name: "Creator" }),
    getSetting("theme", "dark"),
    getSyncConfig(),
    countRecords(),
    getSetting("lastBrief", null),
  ]);

  /* ---------------- profile ---------------- */
  const nameIn = h("input", { class: "input", value: profile?.name || "", placeholder: "Your name" });
  async function saveProfile() {
    await setSetting("profile", { name: nameIn.value.trim() || "Creator" });
    toast("Profile saved", "ok");
  }

  /* ---------------- theme ---------------- */
  async function setTheme(t) {
    await setSetting("theme", t);
    await applyTheme();
    render().then((el) => document.getElementById("pageRoot")?.replaceChildren(el));
  }
  const themeBtns = ["dark", "light", "system"].map((t) =>
    h("button", { class: `btn sm ${theme === t ? "amber" : ""}`, onclick: () => setTheme(t) }, t));

  /* ---------------- server sync ---------------- */
  const urlIn = h("input", { class: "input", value: cfg.serverUrl || "", placeholder: "https://your-studio-server.example.com" });
  const statusLine = h("div", { class: "hint" }, "Status: not checked yet.");
  const syncOut = h("div", { class: "hint", style: "white-space:pre-wrap" });

  async function checkStatus() {
    statusLine.textContent = "Status: checking…";
    const r = await ping(urlIn.value);
    await setSetting("serverUrl", normalize(urlIn.value) || "");
    statusLine.textContent = `Status: ${r.ok ? `reachable ✓ (${r.serverUrl})` : r.reason}`;
    if (r.ok) {
      const s = await sessionInfo(r.serverUrl);
      statusLine.textContent += s.authenticated
        ? ` · signed in as ${s.user.email}`
        : " · not signed in (use login below to enable pull/push)";
    }
  }

  const emailIn = h("input", { class: "input", type: "email", value: cfg.email || "", placeholder: "you@example.com" });
  const passIn = h("input", { class: "input", type: "password", placeholder: "Studio password" });

  async function doLogin() {
    const base = normalize(urlIn.value);
    if (!base) { toast("Enter a valid server URL first (https://… or http://…)", "warn"); return; }
    if (!emailIn.value || !passIn.value) { toast("Email and password required", "warn"); return; }
    syncOut.textContent = "Signing in…";
    const r = await login(base, emailIn.value.trim(), passIn.value);
    if (r.ok) {
      syncOut.textContent = `Signed in as ${r.user?.email || emailIn.value}. You can pull the brief and push scripts now.`;
      toast("Signed in to studio server", "ok");
    } else {
      syncOut.textContent = `Sign-in failed: ${r.reason}`;
      toast("Sign-in failed", "err");
    }
  }

  async function doPull() {
    syncOut.textContent = "Pulling morning brief…";
    const r = await pullBrief(normalize(urlIn.value));
    if (r.ok) {
      syncOut.textContent = `Pulled brief at ${new Date().toISOString().slice(0, 19).replace("T", " ")} — see it on the Dashboard.`;
      toast("Brief pulled from server", "ok");
    } else {
      syncOut.textContent = `Pull failed: ${r.reason}`;
    }
  }

  async function doPush() {
    syncOut.textContent = "Pushing unsynced scripts…";
    const r = await pushAllUnsynced(normalize(urlIn.value));
    const lines = [`Pushed ${r.pushed}/${r.total} script(s).`];
    for (const f of r.failed) lines.push(`FAILED "${f.title}": ${f.reason}`);
    syncOut.textContent = lines.join("\n");
    if (r.failed.length === 0) toast("All scripts synced", "ok"); else toast(`${r.failed.length} push(es) failed`, "err");
  }

  const syncSection = card("Studio server sync (optional)", "the app is fully usable offline — this only adds pull/push when a server is configured",
    h("div", {},
      h("div", { class: "field" }, h("label", { class: "label" }, "Server URL"), urlIn),
      h("div", { class: "btn-row", style: "margin-top:0" },
        h("button", { class: "btn sm", onclick: checkStatus }, "Test connection"),
        h("button", { class: "btn sm", onclick: doPull }, "Pull morning brief"),
        h("button", { class: "btn sm", onclick: doPush }, "Push unsynced scripts")),
      statusLine,
      h("div", { class: "divider" }),
      h("div", { class: "form-row" },
        h("div", { class: "field" }, h("label", { class: "label" }, "Email"), emailIn),
        h("div", { class: "field" }, h("label", { class: "label" }, "Password"), passIn)),
      h("button", { class: "btn primary block", onclick: doLogin }, "Login & sync"),
      syncOut,
      h("div", { class: "hint" }, "Sign-in uses the studio's next-auth credentials flow (cookies). The server must allow this app's origin via its MOBILE_SYNC_ORIGIN setting, otherwise the browser blocks the request and sync reports exactly that.")));

  /* ---------------- data export / import ---------------- */
  async function exportData() {
    const stores = ["kv", "scripts", "posts", "revenue", "sponsors", "maya", "topics", "metrics"];
    const dump = { app: "ai-creator-studio", version: SEED_VERSION, exportedAt: new Date().toISOString(), data: {} };
    for (const s of stores) dump.data[s] = await getAll(s);
    downloadText(`studio-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dump, null, 2), "application/json");
    toast("Backup exported (JSON)", "ok");
  }

  const fileIn = h("input", { type: "file", accept: "application/json,.json", class: "input", style: "padding:8px" });
  async function importData() {
    const file = fileIn.files?.[0];
    if (!file) { toast("Choose a backup file first", "warn"); return; }
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.app !== "ai-creator-studio" || !parsed.data) throw new Error("Not an AI Creator Studio backup file.");
      const ok = await confirmModal({
        title: "Import & replace local data?",
        body: `Backup from ${parsed.exportedAt || "unknown date"} replaces everything currently on this device. Export first if unsure.`,
        confirmLabel: "Import",
        danger: true,
      });
      if (!ok) return;
      await clearAllStores();
      const { put } = await import("../store.js");
      for (const [store, rows] of Object.entries(parsed.data)) {
        for (const row of rows || []) await put(store, row);
      }
      toast("Import complete", "ok");
      navigate("#/dashboard");
    } catch (e) {
      toast(`Import failed: ${e.message}`, "err", 5000);
    }
  }

  async function resetDemo() {
    const ok = await confirmModal({
      title: "Reset to sample workspace?",
      body: "This deletes ALL local data (scripts, posts, revenue, sponsors, chats, settings) and re-seeds the clearly-labeled sample workspace.",
      confirmLabel: "Reset everything",
      danger: true,
    });
    if (!ok) return;
    await clearAllStores();
    await ensureSeeded();
    toast("Workspace reset to sample data", "ok");
    navigate("#/dashboard");
  }

  /* ---------------- about ---------------- */
  const about = card("About", null,
    h("div", { class: "small muted" },
      "AI Creator Studio — offline-first mobile workspace. ", "v", String(SEED_VERSION), " · local store v", String(SEED_VERSION)),
    h("div", { class: "small muted", style: "margin-top:6px" },
      "All data lives on this device (IndexedDB, with a localStorage fallback). Maya runs as an offline assistant on-device. Publishing exports packages you paste into each platform — the app never fakes a post, payment, or AI provider."));

  const totalRecords = counts.reduce((s, c) => s + c.count, 0);
  const kvRow = counts.find((c) => c.store === "scripts");

  return h("div", {},
    card("Profile", "shown as your name across the app",
      h("div", { class: "field" }, h("label", { class: "label" }, "Display name"), nameIn),
      h("button", { class: "btn amber", onclick: saveProfile }, "Save profile")),

    card("Appearance", "dark is the default; follow the system theme with 'system'",
      h("div", { class: "btn-row", style: "margin-top:0" }, themeBtns)),

    syncSection,

    sectionTitle("Data"),
    card("Backup & restore", `${totalRecords} records on device${kvRow ? ` · ${kvRow.count} script(s)` : ""}`,
      h("div", { class: "btn-row", style: "margin-top:0" },
        h("button", { class: "btn sm", onclick: exportData }, "Export JSON")),
      h("div", { class: "field", style: "margin-top:12px" },
        h("label", { class: "label" }, "Import backup"), fileIn),
      h("button", { class: "btn sm", onclick: importData }, "Import & replace")),
    card("Reset", null,
      h("div", { class: "sub", style: "margin-bottom:10px" }, "Wipe this device's workspace and restore the labeled sample data."),
      h("button", { class: "btn danger", onclick: resetDemo }, "Reset workspace")),

    lastBrief?.brief
      ? card("Last pulled brief", `from ${lastBrief.serverUrl} · ${new Date(lastBrief.pulledAt).toLocaleString()}`,
          h("pre", { class: "export" }, JSON.stringify(lastBrief.brief, null, 2).slice(0, 1200)))
      : null,

    about,
  );
}
