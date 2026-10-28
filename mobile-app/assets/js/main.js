/**
 * main.js — app bootstrap: data store init, hash router, shell (top bar +
 * bottom tabs), global error boundary, connectivity chip, theme.
 *
 * Routing model: hash routes (#/dashboard …). Every render is wrapped —
 * a view crash renders an error card with a retry button; the app never
 * white-screens.
 */

import { ensureSeeded, getSetting, setSetting } from "./store.js";
import { h, toast, errorState, icon } from "./ui.js";
import * as dashboard from "./views/dashboard.js";
import * as scripts from "./views/scripts.js";
import * as maya from "./views/maya.js";
import * as publishing from "./views/publishing.js";
import * as monetization from "./views/monetization.js";
import * as settings from "./views/settings.js";

const app = document.getElementById("app");

/* ---------------- routes ---------------- */
const ROUTES = [
  { path: /^#?\/?$/, view: dashboard, tab: "dashboard" },
  { path: /^#\/dashboard$/, view: dashboard, tab: "dashboard" },
  { path: /^#\/scripts$/, view: scripts, tab: "scripts" },
  { path: /^#\/scripts\/new$/, view: scripts, tab: "scripts", params: { id: "new" } },
  { path: /^#\/scripts\/(?<id>[\w-]+)$/, view: scripts, tab: "scripts" },
  { path: /^#\/maya$/, view: maya, tab: "maya" },
  { path: /^#\/publishing$/, view: publishing, tab: "publishing" },
  { path: /^#\/monetization$/, view: monetization, tab: "monetization" },
  { path: /^#\/settings$/, view: settings, tab: "settings" },
];

function matchRoute(hash) {
  for (const r of ROUTES) {
    const m = r.path.exec(hash);
    if (m) return { ...r, params: { ...(r.params || {}), ...(m.groups || {}) } };
  }
  return null;
}

function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}
export { navigate };

/* ---------------- shell ---------------- */
function buildShell() {
  const topbar = h("header", { class: "topbar" },
    h("div", { class: "brand" },
      h("span", { class: "mark", html: '<svg viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg"><path fill="#FBBF24" d="M44,14 L74,14 L58,45 L73,45 L39,95 L49,58 L34,58 Z"/></svg>' }),
      "AI Creator Studio"),
    h("div", { class: "spacer" }),
    h("button", {
      class: "icon-btn", title: "Settings", "aria-label": "Settings",
      onclick: () => navigate("#/settings"),
      html: icon("settings").innerHTML,
    }),
    h("span", { class: "conn-chip", id: "connChip" }, h("span", { class: "dot" }), "offline"));

  const tabs = [
    { key: "dashboard", label: "Home", icon: "dashboard" },
    { key: "scripts", label: "Scripts", icon: "scripts" },
    { key: "maya", label: "Maya", icon: "maya" },
    { key: "publishing", label: "Publish", icon: "publishing" },
    { key: "money", label: "Money", icon: "money" },
  ];
  const tabbar = h("nav", { class: "tabbar", id: "tabbar" },
    tabs.map((t) =>
      h("button", { class: "tab", dataset: { tab: t.key }, onclick: () => navigate(`#/${t.key === "money" ? "monetization" : t.key}`) },
        h("span", { html: icon(t.icon).innerHTML }),
        t.label)));

  app.replaceChildren(topbar, h("main", { id: "pageRoot", class: "page" }), tabbar);
}

function setTab(active) {
  document.querySelectorAll("#tabbar .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === active);
  });
}

function updateConnChip() {
  const chip = document.getElementById("connChip");
  if (!chip) return;
  const online = navigator.onLine;
  chip.className = `conn-chip ${online ? "online" : ""}`;
  chip.replaceChildren(h("span", { class: "dot" }), online ? "online" : "offline");
}
window.addEventListener("online", () => { updateConnChip(); toast("Back online — sync available in Settings", "ok"); });
window.addEventListener("offline", () => { updateConnChip(); toast("Offline — the app keeps working locally", "info"); });

/* ---------------- render + error boundary ---------------- */
let renderSeq = 0;

async function render() {
  const seq = ++renderSeq;
  const root = document.getElementById("pageRoot");
  if (!root) return;

  const hash = location.hash || "#/dashboard";
  const route = matchRoute(hash);

  if (!route) {
    setTab("");
    root.replaceChildren(
      h("div", { class: "card", style: "text-align:center;padding:34px 18px" },
        h("h2", {}, "Page not found"),
        h("div", { class: "sub", style: "margin:6px 0 16px" }, `No screen for "${hash}".`),
        h("button", { class: "btn primary", onclick: () => navigate("#/dashboard") }, "Back to Dashboard")));
    return;
  }

  setTab(route.tab);
  root.replaceChildren(h("div", { class: "skeleton", style: "width:40%" }), h("div", { class: "skeleton", style: "width:100%;margin-top:12px" }), h("div", { class: "skeleton", style: "width:70%;margin-top:12px" }));

  try {
    const el = await route.view.render(route.params || {});
    if (seq !== renderSeq) return; // a newer navigation won
    root.replaceChildren(el);
    window.scrollTo({ top: 0 });
  } catch (err) {
    if (seq !== renderSeq) return;
    console.error("[studio] view error:", err);
    const retry = () => render();
    root.replaceChildren(errorState(err && err.message ? err.message : "The screen failed to load.", retry));
  }
}

/* ---------------- theme ---------------- */
export async function applyTheme() {
  const theme = await getSetting("theme", "dark");
  document.documentElement.dataset.theme = theme === "system"
    ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : theme;
}
matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
  getSetting("theme", "dark").then((t) => { if (t === "system") applyTheme(); });
});

/* ---------------- boot ---------------- */
async function boot() {
  try {
    await ensureSeeded();
    await applyTheme();
  } catch (err) {
    console.error("[studio] boot error", err);
    app.replaceChildren(errorState("The local database failed to open. Try 'Clear app data' from your device settings, then reopen.", () => location.reload()));
    return;
  }
  buildShell();
  updateConnChip();
  window.addEventListener("hashchange", render);
  // expose for inline debugging without polluting views
  window.__studio = { navigate, setSetting };
  render();
}

boot();
