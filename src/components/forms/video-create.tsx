"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type VersionOption = { id: string; label: string };
type VoiceOption = { id: string; label: string; jobId: string };
type AssetOption = { id: string; label: string };

/** Video studio create form: script version + optional voice take + b-roll + aspect. */
export function VideoCreateForm({ versions, voices, brollAssets }: { versions: VersionOption[]; voices: VoiceOption[]; brollAssets: AssetOption[] }) {
  const router = useRouter();
  const [values, setValues] = useState({ scriptVersionId: "", voiceJobId: "", aspect: "16:9" });
  const [broll, setBroll] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOkMsg(null);
    const voice = voices.find((v) => v.jobId === values.voiceJobId);
    try {
      const res = await fetch("/api/video-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scriptVersionId: values.scriptVersionId,
          voiceJobId: values.voiceJobId || undefined,
          voiceAssetId: voice ? voice.id : undefined,
          brollAssetIds: broll,
          aspect: values.aspect,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
      setOkMsg("Video job queued - watch the list below.");
      setValues({ scriptVersionId: "", voiceJobId: "", aspect: "16:9" });
      setBroll([]);
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
        <label htmlFor="vd-version" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Script version</label>
        <select id="vd-version" required className={input} value={values.scriptVersionId} onChange={(e) => setValues((v) => ({ ...v, scriptVersionId: e.target.value }))}>
          <option value="">Choose…</option>
          {versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="vd-voice" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Voiceover take (optional)</label>
        <select id="vd-voice" className={input} value={values.voiceJobId} onChange={(e) => setValues((v) => ({ ...v, voiceJobId: e.target.value }))}>
          <option value="">No voiceover</option>
          {voices.map((v) => <option key={v.jobId} value={v.jobId}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="vd-aspect" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Aspect</label>
        <select id="vd-aspect" className={input} value={values.aspect} onChange={(e) => setValues((v) => ({ ...v, aspect: e.target.value }))}>
          <option value="16:9">16:9 (YouTube)</option>
          <option value="9:16">9:16 (Shorts)</option>
          <option value="1:1">1:1</option>
        </select>
      </div>
      <div>
        <p className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">B-roll ({broll.length} selected)</p>
        <div className="max-h-24 space-y-1 overflow-y-auto">
          {brollAssets.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={broll.includes(a.id)} onChange={() => setBroll((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))} />
              {a.label}
            </label>
          ))}
          {brollAssets.length === 0 && <p className="text-[11px] text-slate-400">Upload b-roll in the Media Library first.</p>}
        </div>
      </div>
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy ? "Queuing…" : "Queue video job"}
      </button>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {okMsg && <p className="text-xs text-emerald-700 dark:text-emerald-300">{okMsg}</p>}
    </form>
  );
}
