"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ProjectOption = { id: string; label: string };

/** Localization project create form with a multi-language chip picker. */
export function LocalizationCreateForm({ scripts, assets }: { scripts: ProjectOption[]; assets: ProjectOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sourceScriptId, setSourceScriptId] = useState("");
  const [sourceAssetId, setSourceAssetId] = useState("");
  const [playbackType, setPlaybackType] = useState("audio");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [languages, setLanguages] = useState<string[]>(["es"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]";
  const candidateLangs = ["es", "de", "fr", "pt", "hi", "ur", "ar", "zh", "ja", "ko", "it", "tr"];

  function toggleLang(l: string) {
    setLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/localization", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, sourceLanguage, sourceScriptId, sourceAssetId, playbackType, languages }),
      });
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
      setOkMsg("Project created.");
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="lc-name" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Project name</label>
        <input id="lc-name" required className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer course promo" />
      </div>
      <div>
        <label htmlFor="lc-script" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Source script (optional)</label>
        <select id="lc-script" className={input} value={sourceScriptId} onChange={(e) => setSourceScriptId(e.target.value)}>
          <option value="">None</option>
          {scripts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="lc-asset" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Source audio/video (optional)</label>
        <select id="lc-asset" className={input} value={sourceAssetId} onChange={(e) => setSourceAssetId(e.target.value)}>
          <option value="">None</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="lc-from" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Source language</label>
          <input id="lc-from" className={input} value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} />
        </div>
        <div>
          <label htmlFor="lc-pt" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Playback type</label>
          <select id="lc-pt" className={input} value={playbackType} onChange={(e) => setPlaybackType(e.target.value)}>
            <option value="audio">Dubbed audio</option>
            <option value="subtitles">Subtitles</option>
            <option value="lipsync">Lip-sync (provider-dependent)</option>
          </select>
        </div>
      </div>
      <div>
        <p className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Target languages ({languages.length} selected)</p>
        <div className="flex flex-wrap gap-1.5">
          {candidateLangs.map((l) => (
            <button key={l} type="button" onClick={() => toggleLang(l)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${languages.includes(l) ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600 dark:border-[#2c3560] dark:text-slate-300"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <button type="submit" disabled={busy || languages.length === 0} className="w-full rounded-lg bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy ? "Creating…" : "Create project"}
      </button>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {okMsg && <p className="text-xs text-emerald-700 dark:text-emerald-300">{okMsg}</p>}
    </form>
  );
}
