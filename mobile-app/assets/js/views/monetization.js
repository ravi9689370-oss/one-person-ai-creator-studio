/**
 * views/monetization.js — revenue ledger, sponsor pipeline, conversion
 * metrics. Money math in cents. Entries YOU record are labeled as locally
 * verified — the app never presents local numbers as provider-verified data.
 */

import { getAll, put, del, uid, iso } from "../store.js";
import { h, card, chip, emptyState, toast, confirmModal, money, fmtDate, stat, banner } from "../ui.js";
import { lineChart, donutChart, funnel as funnelChart } from "../charts.js";
import { navigate } from "../main.js";

const SOURCES = [
  { key: "sponsor", label: "Sponsorship", color: "#fbbf24" },
  { key: "ads", label: "Ad revenue", color: "#60a5fa" },
  { key: "product", label: "Own product", color: "#34d399" },
  { key: "affiliate", label: "Affiliate", color: "#be185d" },
  { key: "other", label: "Other", color: "#9aa7c7" },
];
const STAGES = ["prospect", "negotiation", "scheduled", "delivered", "paid"];

function monthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }

export async function render() {
  const [revenue, sponsors, metrics] = await Promise.all([getAll("revenue"), getAll("sponsors"), getAll("metrics")]);
  const revSorted = [...revenue].sort((a, b) => new Date(b.date) - new Date(a.date));

  const ms = monthStart();
  const thisMonth = revenue.filter((r) => new Date(r.date).getTime() >= ms);
  const totalCents = thisMonth.reduce((s, r) => s + r.amountCents, 0);
  const lifetimeCents = revenue.reduce((s, r) => s + r.amountCents, 0);

  /* ---------- record earning form ---------- */
  const amountIn = h("input", { class: "input", type: "number", min: "0", step: "0.01", placeholder: "e.g. 250.00" });
  const labelIn = h("input", { class: "input", placeholder: "e.g. Newsletter sponsorship — Acme" });
  const sourceSel = h("select", { class: "select" }, SOURCES.map((s) => h("option", { value: s.key }, s.label)));
  const verifiedIn = h("input", { type: "checkbox" });
  verifiedIn.checked = false;

  async function addEarning() {
    const dollars = parseFloat(amountIn.value);
    if (!Number.isFinite(dollars) || dollars <= 0) { toast("Enter a valid amount", "warn"); return; }
    if (!labelIn.value.trim()) { toast("Add a short label", "warn"); return; }
    const row = {
      id: uid(), date: iso(0), source: sourceSel.value, label: labelIn.value.trim(),
      amountCents: Math.round(dollars * 100),
      verified: verifiedIn.checked,
      origin: "local", createdAt: iso(0),
    };
    await put("revenue", row);
    toast(`Recorded ${money(row.amountCents)}${row.verified ? " · owner-verified" : " · unverified"}`, "ok");
    navigate("#/monetization");
  }

  async function removeEarning(row) {
    const ok = await confirmModal({ title: "Delete this entry?", body: `${money(row.amountCents)} — ${row.label}. This removes it from the local ledger.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    await del("revenue", row.id);
    toast("Entry deleted", "ok");
    navigate("#/monetization");
  }

  /* ---------- charts ---------- */
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
    return d.getTime();
  });
  const cum = [];
  let acc = 0;
  for (const day of days) {
    acc += revenue.filter((r) => { const t = new Date(r.date).getTime(); return t >= day && t < day + 86400000; }).reduce((s, r) => s + r.amountCents, 0);
    cum.push(acc / 100);
  }

  const bySource = SOURCES.map((s) => ({
    label: s.label, value: revenue.filter((r) => r.source === s.key).reduce((x, r) => x + r.amountCents, 0) / 100,
    color: s.color,
  })).filter((s) => s.value > 0);

  /* ---------- sponsor pipeline ---------- */
  async function advanceSponsor(sp) {
    const i = STAGES.indexOf(sp.stage);
    if (i < 0 || i >= STAGES.length - 1) return;
    await put("sponsors", { ...sp, stage: STAGES[i + 1], updatedAt: iso(0) });
    toast(`Moved to "${STAGES[i + 1]}"`, "ok");
    navigate("#/monetization");
  }
  const brandIn = h("input", { class: "input", placeholder: "Brand name" });
  const dealIn = h("input", { class: "input", placeholder: "e.g. 1× video integration" });
  const dealAmt = h("input", { class: "input", type: "number", min: "0", step: "0.01", placeholder: "Deal value $" });

  async function addSponsor() {
    if (!brandIn.value.trim()) { toast("Brand name required", "warn"); return; }
    const dollars = parseFloat(dealAmt.value);
    await put("sponsors", {
      id: uid(), brand: brandIn.value.trim(), deal: dealIn.value.trim() || "TBD",
      amountCents: Number.isFinite(dollars) ? Math.round(dollars * 100) : 0,
      stage: "prospect", notes: "", createdAt: iso(0),
    });
    toast("Sponsor added to pipeline", "ok");
    navigate("#/monetization");
  }

  const pipeline = sponsors.length
    ? h("div", {}, sponsors.map((sp) =>
        h("div", { class: "row" },
          h("div", { class: "grow" },
            h("div", { class: "title" }, sp.brand),
            h("div", { class: "meta" }, `${sp.deal || "—"}${sp.amountCents ? ` · ${money(sp.amountCents)}` : ""} · since ${fmtDate(sp.createdAt)}`)),
          h("div", { class: "right" },
            chip(sp.stage, { prospect: "", negotiation: "warn", scheduled: "info", delivered: "info", paid: "ok" }[sp.stage] || ""),
            sp.stage !== "paid" ? h("button", { class: "icon-btn", title: "Advance stage", onclick: () => advanceSponsor(sp), html: '<svg viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>' }) : null,
            h("button", { class: "icon-btn", title: "Delete", onclick: async () => {
              const ok = await confirmModal({ title: `Remove ${sp.brand}?`, body: "Removes the sponsor from the local pipeline.", confirmLabel: "Remove", danger: true });
              if (ok) { await del("sponsors", sp.id); navigate("#/monetization"); }
            }, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>' })))))
    : emptyState("No sponsors yet", "Add a brand below to start the pipeline.", "money");

  /* ---------- conversion metrics (locally entered) ---------- */
  const views = metrics.reduce((s, m) => s + m.views, 0);
  const likes = metrics.reduce((s, m) => s + m.likes, 0);
  const follows = metrics.reduce((s, m) => s + m.follows, 0);
  const engagement = views ? ((likes / views) * 100) : 0;

  const viewsSeries = [...metrics]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((m) => m.views);

  return h("div", {},
    h("div", { class: "grid-2" },
      stat("This month", money(totalCents), `${thisMonth.length} entries`),
      stat("Lifetime", money(lifetimeCents), `${revenue.length} entries on device`)),

    banner("info", "Revenue entries you record here are local ledger entries — labeled owner-verified only when you check the box. Server-verified payment events come from the full studio server, never from this app.", null),

    card("Record an earning", "stored locally in cents (no rounding drift)",
      h("div", { class: "form-row" },
        h("div", { class: "field" }, h("label", { class: "label" }, "Amount ($)"), amountIn),
        h("div", { class: "field" }, h("label", { class: "label" }, "Source"), sourceSel)),
      h("div", { class: "field" }, h("label", { class: "label" }, "Label"), labelIn),
      h("label", { class: "check", style: "margin-bottom:12px" }, verifiedIn, "I verified this myself (owner-verified)"),
      h("button", { class: "btn primary block", onclick: addEarning }, "Add to ledger")),

    card("Revenue (14-day cumulative)", "local ledger", lineChart(cum)),
    bySource.length ? card("Revenue mix", "lifetime by source", donutChart(bySource)) : null,

    h("div", { class: "section-title" }, "Ledger"),
    revSorted.length
      ? card(null, null, h("div", {}, revSorted.slice(0, 12).map((r) =>
          h("div", { class: "row" },
            h("div", { class: "grow" },
              h("div", { class: "title" }, r.label),
              h("div", { class: "meta" }, `${SOURCES.find((s) => s.key === r.source)?.label || r.source} · ${fmtDate(r.date)}`)),
            h("div", { class: "right" },
              r.verified ? chip("verified", "ok") : chip("unverified", "warn"),
              h("span", { class: "money", style: "font-weight:800" }, money(r.amountCents)),
              h("button", { class: "icon-btn", title: "Delete", onclick: () => removeEarning(r), html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>' }))))))
      : card(null, null, emptyState("No earnings recorded", "Add your first entry above.", "money")),

    h("div", { class: "section-title" }, "Sponsor pipeline"),
    card("Add sponsor", null,
      h("div", { class: "form-row" },
        h("div", { class: "field" }, h("label", { class: "label" }, "Brand"), brandIn),
        h("div", { class: "field" }, h("label", { class: "label" }, "Value ($)"), dealAmt)),
      h("div", { class: "field" }, h("label", { class: "label" }, "Deal"), dealIn),
      h("button", { class: "btn primary block", onclick: addSponsor }, "Add to pipeline")),
    card(`Pipeline (${sponsors.length})`, "tap → to advance the stage", pipeline),

    h("div", { class: "section-title" }, "Conversion metrics"),
    h("div", { class: "grid-2" },
      stat("Views (tracked)", views.toLocaleString(), `${metrics.length} daily entries`),
      stat("Engagement", `${engagement.toFixed(1)}%`, `${likes.toLocaleString()} likes · ${follows.toLocaleString()} follows`)),
    card("Views trend", "entered/seeded locally — label your sources when importing real numbers", lineChart(viewsSeries, { stroke: "#60a5fa", fill: "rgba(96,165,250,0.13)" })),
    card("Funnel snapshot", "views → likes → follows (tracked period)",
      funnelChart([
        { name: "Views", count: views },
        { name: "Likes", count: likes },
        { name: "Follows", count: follows },
      ])),
  );
}
