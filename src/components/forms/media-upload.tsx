"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Multipart upload form for the Media Library. Posts multipart/form-data to
 * /api/media (session-authenticated) and refreshes the page.
 */
export function MediaUploadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOkMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch("/api/media", { method: "POST", body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? `Upload failed (${res.status}).`);
      }
      setOkMsg("Uploaded.");
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="media-file" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          File (audio, video, image, or document)
        </label>
        <input
          id="media-file"
          name="file"
          type="file"
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]"
        />
      </div>
      <div>
        <label htmlFor="media-title" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Title
        </label>
        <input
          id="media-title"
          name="title"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]"
          placeholder="Defaults to the file name"
        />
      </div>
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy ? "Uploading…" : "Upload asset"}
      </button>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {okMsg && <p className="text-xs text-emerald-700 dark:text-emerald-300">{okMsg}</p>}
    </form>
  );
}
