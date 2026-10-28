"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Decide-approval buttons for the queue. Also usable for any destructive/
 * sensitive endpoint that supports {decision} payloads.
 */
export function DecisionButtons({
  approvalId,
  disabled,
}: {
  approvalId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected" | "changes_requested") {
    if (decision !== "approved" && !note.trim() && !confirm(`Add a note for the ${decision} decision? Cancel to add one first.`)) {
      setNote("");
      return;
    }
    setBusy(decision);
    setError(null);
    const res = await fetch(`/api/approvals/${approvalId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note: note.trim() || undefined }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Decision failed.");
      return;
    }
    setNote("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Optional review note (required for rejections in most workflows)"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-[#2c3560] dark:bg-[#0b1020]"
        aria-label="Review note"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null || disabled}
          onClick={() => decide("approved")}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy === "approved" ? "…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={busy !== null || disabled}
          onClick={() => decide("changes_requested")}
          className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-60 dark:bg-amber-950/40 dark:text-amber-300"
        >
          Request changes
        </button>
        <button
          type="button"
          disabled={busy !== null || disabled}
          onClick={() => decide("rejected")}
          className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          Reject
        </button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
