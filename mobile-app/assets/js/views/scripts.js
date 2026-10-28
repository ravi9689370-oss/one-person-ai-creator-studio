/**
 * views/scripts.js — the Script/Content Studio.
 * Routes: #/scripts (list) · #/scripts/new (editor, empty) · #/scripts/:id (editor).
 * Features: create/edit/autosave, AI-assisted hooks/outline/caption inserts
 * (offline Maya engine), platform tagging, status flow, export (.txt/.md),
 * archive (delete with confirm). No stubs: every button does something real.
 */

import { getAll, get, put, del, uid, iso } from "../store.js";
import { h, card, chip, emptyState, toast, confirmModal, copyText, downloadText, fmtDate } from "../ui.js";
import { navigate } from "../main.js";
import { hooks, outline, caption, scriptDraft } from "../maya.js";

const STATUSES = ["draft", "in_review", "approved", "archived"];
const PLATFORMS = ["youtube", "instagram", "linkedin", "blog"];

function statusChip(status) {
  const tone = { draft: "", in_review: "warn", approved: "ok", archived: "err" }[status] || "";
  return chip(status.replace("_", " "), tone);
}

/* ---------------- list ---------------- */
async function list() {
  const scripts = (await getAll("scripts"))
    .filter((s) => s.status !== "archived")
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const archived = (await getAll("scripts")).filter((s) => s.status === "archived").length;

  return h("div", {},
    h("div", { class: "btn-row", style: "margin:0 0 14px" },
      h("button", { class: "btn primary", onclick: () => navigate("#/scripts/new") }, "+ New script")),

    scripts.length
      ? card(`Workspace scripts (${scripts.length})`, "tap a script to open the editor",
          h("div", {},
            scripts.map((s) =>
              h("button", { class: "row", onclick: () => navigate(`#/scripts/${s.id}`) },
                h("div", { class: "grow" },
                  h("div", { class: "title" }, s.title || "Untitled"),
                  h("div", { class: "meta" }, `${s.platform || "youtube"} · ${(s.body || "").length} chars · ${fmtDate(s.updatedAt || s.createdAt)}`)),
                h("div", { class: "right" }, statusChip(s.status))))))
      : card(null, null, emptyState("No scripts yet", "Write your first script or ask Maya for a scaffold.", "scripts")),

    archived > 0
      ? h("div", { class: "small muted", style: "margin-top:10px;text-align:center" }, `${archived} archived script(s) — restore from the editor's status menu.`)
      : null);
}

/* ---------------- editor ---------------- */
async function editor(id) {
  const isNew = id === "new";
  const existing = isNew ? null : await get("scripts", id);
  if (!isNew && !existing) {
    return card("Script not found", null,
      h("div", { class: "sub", style: "margin-bottom:12px" }, "It may have been deleted on this device."),
      h("button", { class: "btn primary", onclick: () => navigate("#/scripts") }, "Back to list"));
  }

  const draft = existing || { id: uid(), title: "", hook: "", body: "", platform: "youtube", status: "draft", synced: false, createdAt: iso(0), updatedAt: iso(0) };

  const titleIn = h("input", { class: "input", value: draft.title || "", placeholder: "Working title…", id: "sc-title" });
  const hookIn = h("textarea", { class: "textarea", style: "min-height:70px", placeholder: "The hook — first 5 seconds, the promise.", id: "sc-hook" });
  hookIn.value = draft.hook || "";
  const bodyIn = h("textarea", { class: "textarea editor", placeholder: "Full script. Timestamps optional but recommended.", id: "sc-body" });
  bodyIn.value = draft.body || "";
  const platformIn = h("select", { class: "select", id: "sc-platform" },
    PLATFORMS.map((p) => h("option", { value: p, selected: draft.platform === p ? true : null }, p)));
  const statusIn = h("select", { class: "select", id: "sc-status" },
    STATUSES.map((s) => h("option", { value: s, selected: draft.status === s ? true : null }, s.replace("_", " "))));

  const wordCounter = h("span", { class: "chip" }, `${(draft.body || "").length} chars`);

  async function collect() {
    draft.title = titleIn.value.trim();
    draft.hook = hookIn.value;
    draft.body = bodyIn.value;
    draft.platform = platformIn.value;
    draft.status = statusIn.value;
    draft.updatedAt = new Date().toISOString();
  }

  async function save(silent = false) {
    await collect();
    if (!draft.title) { toast("Add a title before saving", "warn"); titleIn.focus(); return false; }
    await put("scripts", { ...draft });
    if (!silent) toast("Script saved on this device", "ok");
    return true;
  }

  // autosave (debounced)
  let saveTimer = null;
  const autosave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (titleIn.value.trim()) { await save(true); }
    }, 1200);
  };
  titleIn.addEventListener("input", autosave);
  hookIn.addEventListener("input", autosave);
  bodyIn.addEventListener("input", () => {
    wordCounter.textContent = `${bodyIn.value.length} chars`;
    autosave();
  });

  async function aiInsert(kind) {
    const topic = titleIn.value.trim() || draft.title || "";
    let text = "";
    if (kind === "hooks") text = hooks(topic).map((x, i) => `${i + 1}. ${x}`).join("\n");
    if (kind === "outline") text = outline(topic);
    if (kind === "caption") text = caption(platformIn.value, topic);
    if (kind === "scaffold") text = scriptDraft(topic, platformIn.value);
    const target = kind === "hooks" ? hookIn : bodyIn;
    if (kind === "scaffold") bodyIn.value = text;
    else target.value = (target.value ? target.value + "\n\n" : "") + text;
    autosave();
    toast(`Maya (offline) generated the ${kind === "scaffold" ? "scaffold" : kind}`, "info");
  }

  async function exportScript() {
    await collect();
    const platform = platformIn.value;
    const text = `# ${draft.title || "Untitled"}\nPlatform: ${platform}\nStatus: ${statusIn.value}\n\n## Hook\n${hookIn.value}\n\n## Script\n${bodyIn.value}\n\n## Caption\n${caption(platform, draft.title)}\n`;
    downloadText(`${(draft.title || "script").replace(/[^\w-]+/g, "_").slice(0, 40)}.md`, text, "text/markdown");
    toast("Exported as Markdown", "ok");
  }

  async function archiveOrRestore() {
    await collect();
    const archiving = draft.status !== "archived";
    if (archiving) {
      const ok = await confirmModal({
        title: "Archive this script?",
        body: "Archived scripts stay on the device and can be restored from the status menu. Nothing is deleted.",
        confirmLabel: "Archive",
        danger: false,
      });
      if (!ok) return;
      draft.status = "archived";
    } else {
      draft.status = "draft";
    }
    await put("scripts", draft);
    toast(archiving ? "Script archived" : "Script restored to draft", "ok");
    navigate("#/scripts");
  }

  async function pushToServer() {
    const { pushScript, getSyncConfig } = await import("../sync.js");
    const cfg = await getSyncConfig();
    if (!cfg.serverUrl) { toast("No server configured — app runs offline. Add one in Settings.", "warn"); return; }
    const btnLabel = pushBtn.textContent;
    pushBtn.disabled = true; pushBtn.textContent = "Pushing…";
    await save(true);
    const res = await pushScript(cfg.serverUrl, draft);
    pushBtn.disabled = false; pushBtn.textContent = btnLabel;
    if (res.ok) {
      draft.synced = true; draft.syncedAt = new Date().toISOString();
      await put("scripts", draft);
      toast("Pushed to the studio server", "ok");
    } else {
      toast(res.reason, "err", 5200);
    }
  }

  const pushBtn = h("button", { class: "btn ghost sm", onclick: pushToServer }, existing && existing.synced ? "Re-push to server" : "Push to server");

  return h("div", {},
    h("div", { class: "btn-row", style: "margin:0 0 14px" },
      h("button", { class: "btn ghost sm", onclick: () => navigate("#/scripts") }, "← Scripts")),

    card(null, null,
      h("div", { class: "field" }, h("label", { class: "label" }, "Title"), titleIn),
      h("div", { class: "form-row" },
        h("div", { class: "field" }, h("label", { class: "label" }, "Platform"), platformIn),
        h("div", { class: "field" }, h("label", { class: "label" }, "Status"), statusIn)),
      h("div", { class: "field" }, h("label", { class: "label" }, "Hook"), hookIn),
      h("div", { class: "field" },
        h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px" },
          h("label", { class: "label", style: "margin:0" }, "Script"),
          wordCounter),
        bodyIn)),

    card("Maya assist (offline engine)", "generated text is a draft — always review before publishing",
      h("div", { class: "btn-row" },
        h("button", { class: "btn sm", onclick: () => aiInsert("scaffold") }, "Full scaffold"),
        h("button", { class: "btn sm", onclick: () => aiInsert("hooks") }, "Hook ideas"),
        h("button", { class: "btn sm", onclick: () => aiInsert("outline") }, "Outline"),
        h("button", { class: "btn sm", onclick: () => aiInsert("caption") }, "Caption"))),

    card("Save & export", null,
      h("div", { class: "btn-row" },
        h("button", { class: "btn amber", onclick: () => { save(); } }, "Save"),
        h("button", { class: "btn sm", onclick: exportScript }, "Export .md"),
        h("button", { class: "btn sm", onclick: async () => {
          await collect();
          const ok = await copyText(`${draft.title}\n\n${draft.hook}\n\n${draft.body}`);
          toast(ok ? "Copied to clipboard" : "Copy failed — long-press to select instead", ok ? "ok" : "warn");
        } }, "Copy all"),
        pushBtn,
        h("button", { class: "btn sm danger", onclick: archiveOrRestore },
          draft.status === "archived" ? "Restore" : "Archive")),
      h("div", { class: "hint" },
        `Autosaves ~1.2s after you stop typing · created ${fmtDate(draft.createdAt)} · ${draft.synced ? "synced to server" : "local only (not synced)"}`)));
}

export async function render(params = {}) {
  return params.id ? editor(params.id) : list();
}
