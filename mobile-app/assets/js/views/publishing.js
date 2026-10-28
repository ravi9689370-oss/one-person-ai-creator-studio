/**
 * views/publishing.js — multi-platform publishing hub (YouTube, Instagram,
 * LinkedIn, Blog). Schedule posts, track queue status, export ready-to-paste
 * packages. Honest publishing: "published" here means YOU marked it done —
 * the app never fakes a platform API call.
 */

import { getAll, put, del, uid, iso } from "../store.js";
import { h, card, chip, emptyState, toast, confirmModal, copyText, downloadText, fmtDateTime, fmtDate } from "../ui.js";
import { caption } from "../maya.js";
import { navigate } from "../main.js";
import { barChart } from "../charts.js";

const PLATFORMS = [
  { key: "youtube", label: "YouTube", color: "#f87171" },
  { key: "instagram", label: "Instagram", color: "#fbbf24" },
  { key: "linkedin", label: "LinkedIn", color: "#60a5fa" },
  { key: "blog", label: "Blog / Newsletter", color: "#34d399" },
];

function statusTone(status) {
  return { queued: "warn", published: "ok", failed: "err", draft: "" }[status] || "";
}

export async function render() {
  const [posts, scripts] = await Promise.all([getAll("posts"), getAll("scripts")]);
  const activeScripts = scripts.filter((s) => s.status !== "archived");
  const sorted = posts.sort((a, b) => new Date(b.scheduledFor || b.createdAt) - new Date(a.scheduledFor || a.createdAt));

  /* -------- schedule form -------- */
  const scriptSel = h("select", { class: "select", id: "pub-script" },
    h("option", { value: "" }, "Choose a script…"),
    activeScripts.map((s) => h("option", { value: s.id }, s.title || "Untitled")));
  const platformSel = h("select", { class: "select", id: "pub-platform" },
    PLATFORMS.map((p) => h("option", { value: p.key }, p.label)));
  const whenIn = h("input", { class: "input", type: "datetime-local", id: "pub-when" });
  const whenDefault = new Date(Date.now() + 86400000);
  whenDefault.setMinutes(0, 0, 0);
  whenIn.value = new Date(whenDefault.getTime() - whenDefault.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  async function schedule() {
    const script = activeScripts.find((s) => s.id === scriptSel.value);
    if (!script) { toast("Pick a script first", "warn"); return; }
    const when = whenIn.value ? new Date(whenIn.value).toISOString() : iso(0);
    await put("posts", {
      id: uid(), scriptId: script.id, scriptTitle: script.title || "Untitled",
      platform: platformSel.value, scheduledFor: when, status: "queued",
      caption: caption(platformSel.value, script.title), note: "", createdAt: iso(0),
    });
    toast(`Queued for ${platformSel.value} · ${fmtDateTime(when)}`, "ok");
    navigate("#/publishing");
  }

  async function mark(post, status) {
    await put("posts", { ...post, status, resolvedAt: new Date().toISOString() });
    toast(status === "published" ? "Marked as published" : status === "failed" ? "Marked as failed" : "Back in queue", status === "failed" ? "warn" : "ok");
    navigate("#/publishing");
  }

  async function removePost(post) {
    const ok = await confirmModal({ title: "Remove from queue?", body: `"${post.scriptTitle}" → ${post.platform}. This only removes the local queue entry.`, confirmLabel: "Remove", danger: true });
    if (!ok) return;
    await del("posts", post.id);
    toast("Removed", "ok");
    navigate("#/publishing");
  }

  async function exportPackage(post) {
    const text = `== ${post.platform.toUpperCase()} PACKAGE ==\nTitle/Topic: ${post.scriptTitle}\nScheduled: ${fmtDateTime(post.scheduledFor)}\nStatus: ${post.status}\n\nCAPTION\n${post.caption || caption(post.platform, post.scriptTitle)}\n\n(Download/copy this, paste into ${post.platform}. The app never auto-posts or fakes a platform API.)`;
    downloadText(`${post.platform}-package-${fmtDate(post.scheduledFor).replace(/\s/g, "")}.txt`, text);
    toast("Package exported", "ok");
  }

  const queueBody = sorted.length
    ? h("div", {}, sorted.map((p) =>
        h("div", { class: "row" },
          h("div", { class: "grow" },
            h("div", { class: "title" }, p.scriptTitle),
            h("div", { class: "meta" }, `${p.platform} · ${fmtDateTime(p.scheduledFor)}`)),
          h("div", { class: "right" },
            chip(p.status, statusTone(p.status)),
            h("button", { class: "icon-btn", title: "Export package", onclick: () => exportPackage(p), html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/></svg>' }),
            p.status === "queued" ? h("button", { class: "icon-btn", title: "Mark published", onclick: () => mark(p, "published"), html: '<svg viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' }) : null,
            p.status !== "failed" && p.status !== "queued" ? h("button", { class: "icon-btn", title: "Back to queue", onclick: () => mark(p, "queued"), html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>' }) : null,
            p.status !== "failed" ? h("button", { class: "icon-btn", title: "Mark failed", onclick: () => mark(p, "failed"), html: '<svg viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' }) : null,
            h("button", { class: "icon-btn", title: "Remove", onclick: () => removePost(p), html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>' })))))
    : emptyState("Queue is empty", "Schedule a post below — packages export as text you paste into each platform.", "publishing");

  /* -------- per-platform counts -------- */
  const bars = PLATFORMS.map((p) => ({ label: p.label, value: posts.filter((x) => x.platform === p.key && x.status === "queued").length }));

  return h("div", {},
    card("Platform queues", "you mark the final publish — the app never fakes platform posts",
      h("div", {}, queueBody)),

    card("Schedule a post", null,
      h("div", { class: "field" }, h("label", { class: "label" }, "Script"), scriptSel),
      h("div", { class: "form-row" },
        h("div", { class: "field" }, h("label", { class: "label" }, "Platform"), platformSel),
        h("div", { class: "field" }, h("label", { class: "label" }, "When"), whenIn)),
      h("button", { class: "btn primary block", onclick: schedule }, "Add to queue")),

    card("Queued by platform", "current queue counts", barChart(bars)),

    activeScripts.length === 0
      ? banner("warn", "No scripts available to schedule. Create one in the Script Studio first.",
          h("button", { class: "btn sm amber", onclick: () => navigate("#/scripts/new") }, "New script"))
      : null);
}
