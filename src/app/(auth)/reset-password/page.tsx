"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Reset failed.");
      setBusy(false);
      return;
    }
    router.push("/login");
  }

  if (!token) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Missing reset token. Open the link from your reset email.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="rp-pw" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">New password</label>
        <input id="rp-pw" type="password" required minLength={8} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="rp-cf" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm password</label>
        <input id="rp-cf" type="password" required minLength={8} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy ? "Updating…" : "Update password"}
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-indigo-700 hover:underline dark:text-indigo-400">Back to sign in</Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 text-slate-900 shadow-pop dark:bg-[#111830] dark:text-slate-100">
      <header>
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Minimum 8 characters.</p>
      </header>
      <Suspense fallback={<p className="text-sm">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
