/**
 * views/maya.js — Maya AI assistant chat. Fully offline engine; the full
 * conversation is persisted locally. Every Maya message is labeled so users
 * always know they're talking to an AI assistant.
 */

import { getAll, put, getSetting, uid, iso } from "../store.js";
import { h, card, toast, timeAgo, banner } from "../ui.js";
import { answer, SUGGESTIONS, disclaimerLine } from "../maya.js";
import { navigate } from "../main.js";

export async function render() {
  const [messages, scripts, profile] = await Promise.all([
    getAll("maya"), getAll("scripts"),
    getSetting("profile", { name: "Creator" }),
  ]);
  const sorted = messages.sort((a, b) => new Date(a.at) - new Date(b.at));
  const topTopic = scripts[0]?.title || "";

  const thread = h("div", { class: "chat-thread", id: "chatThread" });
  for (const m of sorted) {
    thread.append(h("div", { class: `bubble ${m.role}` },
      h("span", { class: "who" }, m.role === "maya" ? "Maya · AI (offline)" : (profile.name || "You")),
      m.text,
      h("span", { class: "who", style: "margin:6px 0 0;opacity:.5;font-size:9.5px" }, timeAgo(m.at))));
  }

  const input = h("input", { placeholder: "Ask Maya — hooks, outline, caption, pricing…", "aria-label": "Message Maya" });
  const sendBtn = h("button", { class: "btn amber sm", style: "border-radius:999px" }, "Send");

  async function send(text) {
    const value = (text ?? input.value).trim();
    if (!value) return;
    input.value = "";
    const userMsg = { id: uid(), role: "user", text: value, at: iso(0) };
    await put("maya", userMsg);
    thread.append(h("div", { class: "bubble user" },
      h("span", { class: "who" }, profile.name || "You"), value));
    thread.scrollTop = thread.scrollHeight;

    // simulated thinking pause keeps the interaction legible (no fake API)
    sendBtn.disabled = true;
    await new Promise((r) => setTimeout(r, 420));
    const { text: reply } = answer(value, { topTopic, recentScripts: scripts.slice(0, 5), followers: 10000 });
    const mayaMsg = { id: uid(), role: "maya", text: reply, at: iso(0) };
    await put("maya", mayaMsg);
    thread.append(h("div", { class: "bubble maya" },
      h("span", { class: "who" }, "Maya · AI (offline)"),
      reply,
      h("span", { class: "who", style: "margin:6px 0 0;opacity:.5;font-size:9.5px" }, timeAgo(mayaMsg.at))));
    thread.scrollTop = thread.scrollHeight;
    sendBtn.disabled = false;
  }

  sendBtn.addEventListener("click", () => send());
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });

  return h("div", {},
    banner("info", disclaimerLine(), null),

    card("Conversation", topTopic ? `context: your top script "${topTopic}"` : "context: fresh workspace",
      h("div", {},
        thread,
        h("div", { class: "suggest-row" },
          SUGGESTIONS.map((s) => h("button", { class: "suggest", onclick: () => send(s) }, s))),
        h("div", { class: "chat-input" },
          input,
          sendBtn))),

    h("div", { class: "btn-row", style: "justify-content:center" },
      h("button", { class: "btn ghost sm", onclick: () => navigate("#/scripts/new") }, "Open Script Studio"),
      h("button", { class: "btn ghost sm", onclick: () => navigate("#/publishing") }, "Publishing Hub")));
}
