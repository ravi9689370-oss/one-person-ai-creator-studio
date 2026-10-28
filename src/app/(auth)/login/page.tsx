"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Invalid email or password.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid w-full gap-10 rounded-2xl bg-white/95 p-8 text-slate-900 shadow-pop md:grid-cols-2 md:p-0">
      <div className="hidden md:block md:rounded-l-2xl md:bg-[#0b1020] md:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><path d=%22M40 40h16v16H40z%22 fill=%22%23ffffff22 fill-opacity=%220.04%22/></svg>')] md:p-10">
        <Logo dark />
        <div className="mt-24 flex h-full flex-col justify-between">
          <div className="space-y-3 text-slate-300">
            <h1 className="text-2xl font-semibold text-white">One person. One system. A full studio.</h1>
            <p className="text-sm leading-6">
              Plan, produce, publish, and sell - with a multi-agent studio running the routine work and your
              approval on everything that matters.
            </p>
          </div>
          <p className="text-xs text-slate-500">Demo seed account: creator@example.com / studio-dev-2026 (from your .env)</p>
        </div>
      </div>

      <div className="md:p-10 md:pl-4">
        <div className="md:hidden">
          <Logo />
        </div>
        <h2 className="mt-6 text-xl font-semibold md:mt-0">Sign in</h2>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <div className="flex items-center justify-between text-sm">
            <Link className="text-indigo-700 hover:underline" href="/register">Create an account</Link>
            <Link className="text-indigo-700 hover:underline" href="/forgot-password">Forgot password?</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
