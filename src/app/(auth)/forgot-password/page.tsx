"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; resetUrl?: string; notice?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResult(await res.json());
    setBusy(false);
  }

  return (
    <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 text-slate-900 shadow-pop dark:bg-[#111830] dark:text-slate-100">
      <header>
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter your account email to receive a reset link.</p>
      </header>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="fp-email" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <input id="fp-email" type="email" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? "Creating reset link…" : "Send reset link"}
        </button>
      </form>
      {result && (
        <div className="space-y-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-[#182040] dark:text-slate-300">
          <p>{result.message}</p>
          {result.resetUrl && (
            <>
              <p className="text-xs text-amber-700 dark:text-amber-400">{result.notice}</p>
              <Link href={result.resetUrl} className="inline-block rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                Open reset link
              </Link>
            </>
          )}
        </div>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="text-indigo-700 hover:underline dark:text-indigo-400">Back to sign in</Link>
      </p>
    </div>
  );
}
