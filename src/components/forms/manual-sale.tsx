"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Manual sale recorder. The acknowledgment checkbox is required: the recorded
 * order is flagged unverified until a signed provider payment event verifies it.
 */
export function ManualSaleForm({ products }: { products: { id: string; label: string }[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-[#2c3560] dark:bg-[#0b1020]";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ack) {
      setError("You must acknowledge this order was paid outside a verified provider.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/monetization", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "order", productId, buyerName, buyerEmail: buyerEmail || undefined, manual: true, acknowledge: true, note: note || undefined }),
      });
      const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!res.ok) throw new Error(data?.error?.message ?? `Failed (${res.status}).`);
      setOkMsg("Recorded as an unverified manual order.");
      setBuyerName("");
      setBuyerEmail("");
      setAck(false);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (products.length === 0) {
    return <p className="text-xs text-slate-400">Create a product first.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label htmlFor="ms-product" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Product</label>
        <select id="ms-product" required className={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Choose…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="ms-name" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Buyer name</label>
        <input id="ms-name" required className={input} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="ms-email" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Buyer email (optional)</label>
        <input id="ms-email" type="email" className={input} value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} />
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
        <span>
          <strong>Unverified confirmation.</strong> This order was paid outside a connected provider and will be labeled unverified until a signed payment event verifies it.
        </span>
      </label>
      <div>
        <label htmlFor="ms-note" className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Note (optional)</label>
        <input id="ms-note" className={input} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button type="submit" disabled={busy || !ack} className="w-full rounded-lg bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
        {busy ? "Recording…" : "Record manual order"}
      </button>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {okMsg && <p className="text-xs text-emerald-700 dark:text-emerald-300">{okMsg}</p>}
    </form>
  );
}
