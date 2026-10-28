/**
 * ui.js — tiny DOM kit + shared components. Every view is built from these,
 * so all pages share one consistent, safe rendering path (no innerHTML with
 * untrusted data; text goes through esc()).
 */

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v; // only for trusted, self-generated markup
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function money(cents) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function fmtDateTime(isoString) {
  const d = new Date(isoString);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}
export function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/* ---------------- shared components ---------------- */

export function card(title, sub, body, headExtra) {
  const head = title
    ? h("div", { class: "card-head" },
        h("div", {}, h("h2", {}, title), sub ? h("div", { class: "sub" }, sub) : null),
        headExtra || null)
    : null;
  return h("div", { class: "card" }, head, body);
}

export function stat(label, value, delta) {
  return h("div", { class: "card stat" },
    h("div", { class: "label" }, label),
    h("div", { class: "value" }, value),
    delta ? h("div", { class: "delta" }, delta) : null);
}

export function chip(text, tone = "") {
  return h("span", { class: `chip ${tone}` }, h("span", { class: "dot" }), text);
}

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  scripts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  maya: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="4"/></svg>',
  publishing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 6.5c-1-1.3-2.8-2-5-2-2.8 0-4.5 1.4-4.5 3.4 0 4.6 9.7 2.4 9.7 7.1 0 2-1.9 3.5-5.2 3.5-2.4 0-4.3-.8-5.3-2.2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h4l2 3h6l2-3h4"/></svg>',
};

export function icon(name) {
  const tpl = ICONS[name] || ICONS.inbox;
  const span = h("span", { html: tpl, style: "display:inline-flex" });
  return span.firstChild ? span : span; // span contains the svg via html
}

export function emptyState(title, sub, iconKey = "inbox") {
  return h("div", { class: "empty" },
    h("span", { html: ICONS[iconKey] || ICONS.inbox }),
    h("div", { class: "t" }, title),
    h("div", { class: "s" }, sub));
}

export function errorState(message, onRetry) {
  return h("div", { class: "errbox" },
    h("div", { class: "t" }, "Something went wrong"),
    h("div", { class: "s" }, message || "An unexpected error occurred. Your local data is safe."),
    onRetry ? h("button", { class: "btn amber", onclick: onRetry }, "Try again") : null);
}

export function banner(kind, text, action) {
  return h("div", { class: `banner ${kind}` },
    h("div", { class: "grow" }, text),
    action || null);
}

/* ---------------- toasts ---------------- */
let toastWrap = null;
export function toast(text, tone = "info", ms = 3200) {
  if (!toastWrap) {
    toastWrap = h("div", { class: "toast-wrap" });
    document.body.append(toastWrap);
  }
  const t = h("div", { class: `toast ${tone}` }, h("span", { class: "dot" }), text);
  toastWrap.append(t);
  setTimeout(() => {
    t.classList.add("leaving");
    setTimeout(() => t.remove(), 300);
  }, ms);
}

/* ---------------- modal ---------------- */
export function confirmModal({ title, body, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const close = (val) => { backdrop.remove(); resolve(val); };
    const backdrop = h("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === backdrop) close(false); } },
      h("div", { class: "modal", role: "dialog" },
        h("h3", {}, title),
        h("div", { class: "body" }, body),
        h("div", { class: "btn-row" },
          h("button", { class: "btn ghost", onclick: () => close(false) }, "Cancel"),
          h("button", { class: `btn ${danger ? "danger" : "amber"}`, onclick: () => close(true) }, confirmLabel))));
    document.body.append(backdrop);
  });
}

/* ---------------- download / clipboard helpers ---------------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = h("textarea", { style: "position:fixed;opacity:0" });
      ta.value = text;
      document.body.append(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
