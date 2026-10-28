"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Approve / reject / changes-requested form used on the Approvals page. */
export function ApprovalDecisionForm({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-[#2c3560] dark:bg-[#0b1020]";

  async function decide(decision: "approved" | "rejected" | "changes_requested") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) throw new Error(data?.error?.message ?? `Failed (${res.status}).`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  const btn = "rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60";
  return (
    <div className="mt-2 space-y-1.5">
      <input className={input} placeholder="Optional note (kept in the audit trail)" value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void decide("approved")} className={`${btn} bg-emerald-600 hover:bg-emerald-700`}>Approve</button>
        <button type="button" disabled={busy} onClick={() => void decide("changes_requested")} className={`${btn} bg-amber-600 hover:bg-amber-700`}>Request changes</button>
        <button type="button" disabled={busy} onClick={() => void decide("rejected")} className={`${btn} bg-rose-600 hover:bg-rose-700`}>Reject</button>
      </div>
      {error && <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
