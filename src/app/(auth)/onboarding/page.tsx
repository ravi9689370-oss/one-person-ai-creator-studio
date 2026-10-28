"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Asia/Jerusalem",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(typeof window !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [dailyBrief, setDailyBrief] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, timezone }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Workspace creation failed.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 text-slate-900 shadow-pop dark:bg-[#111830] dark:text-slate-100">
      <Logo />
      <header className="pt-2">
        <h1 className="text-xl font-semibold">Set up your studio</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          One workspace holds your brand profile, calendar, production, and sales. You can rename everything later.
        </p>
      </header>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="ws-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Studio / brand name</label>
          <input id="ws-name" required minLength={2} maxLength={80} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Solo Creator HQ" />
        </div>
        <div>
          <label htmlFor="ws-tz" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</label>
          <select id="ws-tz" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
            <option value={timezone}>{timezone}</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Used for the 7:00 AM morning briefing schedule.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={dailyBrief} onChange={(e) => setDailyBrief(e.target.checked)} className="h-4 w-4 rounded accent-indigo-600" />
          Deliver the executive briefing daily at 7:00 AM
        </label>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
        <button type="submit" disabled={busy || name.trim().length < 2} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? "Creating studio…" : "Create studio"}
        </button>
      </form>
    </div>
  );
}
