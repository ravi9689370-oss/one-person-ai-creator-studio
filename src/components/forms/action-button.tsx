"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A client button that posts a JSON body to an endpoint (client-style request)
 * and refreshes the server-rendered tree on success. Used for one-click
 * actions like approve decisions, publish attempts, and agent runs.
 */
export function ActionButton({
  endpoint,
  method = "POST",
  body,
  label,
  busyLabel = "Working…",
  className,
  confirmText,
  doneMessage,
}: {
  endpoint: string;
  method?: "POST" | "PATCH" | "DELETE" | "PUT";
  body?: Record<string, unknown>;
  label: string;
  busyLabel?: string;
  className?: string;
  confirmText?: string;
  doneMessage?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "DELETE" && !body ? undefined : JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? `Request failed (${res.status}).`);
      }
      setOkMsg(doneMessage ?? "Done.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:opacity-60",
          className ??
            "bg-indigo-600 text-white hover:bg-indigo-700",
        )}
      >
        {busy ? busyLabel : label}
      </button>
      {error && <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{error}</span>}
      {okMsg && <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{okMsg}</span>}
    </span>
  );
}

/** Styled secondary (outline) action. */
export function ActionButtonOutline(props: { className?: string } & React.ComponentProps<typeof ActionButton>) {
  return (
    <ActionButton
      {...props}
      className={props.className ?? "border border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-[#2c3560] dark:bg-[#16204a] dark:text-slate-200"}
    />
  );
}
