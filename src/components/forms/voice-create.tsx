"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type VersionOption = { id: string; label: string };
type ProfileOption = { id: string; label: string };

/** Voice Lab create form: pick a script version + optional voice profile. */
export function VoiceCreateForm({ versions, profiles }: { versions: VersionOption[]; profiles: ProfileOption[] }) {
  const router = useRouter();
  const [values, setValues] = useState({ scriptVersionId: "", voiceProfileId: "", language: "en", style: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/voice-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
      setOkMsg("Voice job queued - watch the job list below.");
      setValues({ scriptVersionId: "", voiceProfileId: "", language: "en", style: "" });
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
        <label htmlFor="vc-version" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Script version</label>
        <select id="vc-version" required className={input} value={values.scriptVersionId} onChange={(e) => setValues((v) => ({ ...v, scriptVersionId: e.target.value }))}>
          <option value="">Choose…</option>
          {versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="vc-profile" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Voice profile (optional)</label>
        <select id="vc-profile" className={input} value={values.voiceProfileId} onChange={(e) => setValues((v) => ({ ...v, voiceProfileId: e.target.value }))}>
          <option value="">Default voice</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="vc-lang" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Language</label>
          <input id="vc-lang" className={input} value={values.language} onChange={(e) => setValues((v) => ({ ...v, language: e.target.value }))} placeholder="en" />
        </div>
        <div>
          <label htmlFor="vc-style" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Style note</label>
          <input id="vc-style" className={input} value={values.style} onChange={(e) => setValues((v) => ({ ...v, style: e.target.value }))} placeholder="e.g. energetic, close-mic" />
        </div>
      </div>
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy ? "Queuing…" : "Generate voiceover"}
      </button>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {okMsg && <p className="text-xs text-emerald-700 dark:text-emerald-300">Job queued - watch the list below.</p>}
    </form>
  );
}
