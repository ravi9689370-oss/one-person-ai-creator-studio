/**
 * views/dashboard.js — pipeline overview, stats, charts, quick actions,
 * recent activity. Everything computed from the local store (works offline).
 */

import { getAll, getSetting } from "../store.js";
import { h, card, stat, chip, money, fmtDate, timeAgo, emptyState, banner } from "../ui.js";
import { lineChart, funnel } from "../charts.js";
import { navigate } from "../main.js";

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export async function render() {
  const [scripts, posts, revenue, metrics, profile, lastBrief] = await Promise.all([
    getAll("scripts"), getAll("posts"), getAll("revenue"), getAll("metrics"),
    getSetting("profile", { name: "Creator" }),
    getSetting("lastBrief", null),
  ]);

  const ms = monthStart();
  const revenueThisMonth = revenue
    .filter((r) => new Date(r.date).getTime() >= ms)
    .reduce((s, r) => s + r.amountCents, 0);
  const queued = posts.filter((p) => p.status === "queued").length;
  const published = posts.filter((p) => p.status === "published").length;
  const drafts = scripts.filter((s) => s.status === "draft").length;

  // pipeline funnel: topics → drafts → approved → scheduled → published
  const approved = scripts.filter((s) => ["approved", "scheduled"].includes(s.status)).length;
  const funnelEl = funnel([
    { name: "Ideas", count: (await getAll("topics")).length },
    { name: "Drafts", count: drafts },
    { name: "Approved", count: approved },
    { name: "Queued", count: queued },
    { name: "Published", count: published },
  ]);

  // revenue sparkline: last 14 days cumulative
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
    return d.getTime();
  });
  const cum = [];
  let acc = 0;
  for (const day of days) {
    acc += revenue.filter((r) => {
      const t = new Date(r.date).getTime(); const d0 = day; const d1 = day + 86400000;
      return t >= d0 && t < d1;
    }).reduce((s, r) => s + r.amountCents, 0);
    cum.push(acc / 100);
  }

  const quick = [
    { label: "New script", to: "#/scripts/new", cls: "primary" },
    { label: "Ask Maya", to: "#/maya", cls: "amber" },
    { label: "Schedule post", to: "#/publishing", cls: "" },
    { label: "Record earning", to: "#/monetization", cls: "" },
  ];

  const activity = [
    ...scripts.map((s) => ({ at: s.updatedAt || s.createdAt, text: `Script ${s.status === "draft" ? "drafted" : "updated"}: ${s.title}`, to: `#/scripts/${s.id}` })),
    ...posts.map((p) => ({ at: p.createdAt, text: `${p.platform} post ${p.status}: ${p.scriptTitle}`, to: "#/publishing" })),
    ...revenue.map((r) => ({ at: r.date, text: `Earning recorded: ${money(r.amountCents)} — ${r.label}`, to: "#/monetization" })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 6);

  const el = h("div", {},
    // offline demo-data banner on the very first screen keeps context honest
    banner("info", "This workspace is stored on-device. Everything works offline; sync with the full studio server from Settings.", null),

    h("div", { class: "grid-2" },
      stat("Revenue (this month)", money(revenueThisMonth), `${revenue.filter((r) => new Date(r.date).getTime() >= ms).length} entries · local ledger`),
      stat("Queued posts", String(queued), `${published} published all-time`)),
    h("div", { style: "height:12px" }),
    h("div", { class: "grid-2" },
      stat("Scripts", String(scripts.length), `${drafts} in draft`),
      stat("Avg views / day", metrics.length ? Math.round(metrics.reduce((s, m) => s + m.views, 0) / metrics.length).toLocaleString() : "—", `${metrics.length} days tracked (local)`)),

    card("Pipeline", "ideas → drafts → approved → scheduled → published", funnelEl),
    card("Revenue (14-day cumulative)", "recorded in the local ledger", lineChart(cum)),

    card("Quick actions", null,
      h("div", { class: "btn-row" },
        quick.map((q) => h("button", { class: `btn ${q.cls}`, onclick: () => navigate(q.to) }, q.label)))),

    lastBrief && lastBrief.brief
      ? card("Latest studio brief (pulled from server)", `pulled ${timeAgo(lastBrief.pulledAt)} from ${lastBrief.serverUrl}`,
          h("div", { class: "small muted" }, "Open Settings → Studio server sync to refresh."),
          h("button", { class: "btn sm ghost", onclick: () => navigate("#/settings") }, "Open Settings"))
      : null,

    h("div", { class: "section-title" }, "Recent activity"),
    activity.length
      ? card(null, null, h("div", {},
          activity.map((a) =>
            h("button", { class: "row", onclick: () => navigate(a.to) },
              h("div", { class: "grow" },
                h("div", { class: "title" }, a.text),
                h("div", { class: "meta" }, `${fmtDate(a.at)} · ${timeAgo(a.at)}`))))))
      : card(null, null, emptyState("No activity yet", "Create your first script to get the pipeline moving.", "scripts")),

    h("div", { class: "small muted", style: "text-align:center;margin-top:18px" },
      `${profile.name || "Creator"} · local workspace v3 · ${scripts.length + posts.length + revenue.length} records on device`),
  );
  return el;
}
