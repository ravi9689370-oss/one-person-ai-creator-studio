const STYLES: Record<string, string> = {
  queued: "bg-slate-100 text-slate-600 dark:bg-[#1a2148] dark:text-slate-300",
  running: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  waiting_for_approval: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  succeeded: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  failed: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-[#1a2148] dark:text-slate-400",
  draft: "bg-slate-100 text-slate-600 dark:bg-[#1a2148] dark:text-slate-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  pending_approval: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  in_review: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  open: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  escalated: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  closed: "bg-slate-100 text-slate-500",
  active: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  idea: "bg-slate-100 text-slate-600",
  published: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
  awaiting_payment: "bg-amber-50 text-amber-700",
  refunded: "bg-slate-100 text-slate-500",
  scheduled: "bg-blue-50 text-blue-700",
  in_production: "bg-blue-50 text-blue-700",
  ready: "bg-violet-50 text-violet-700",
  disconnected: "bg-slate-100 text-slate-500",
  connected: "bg-emerald-50 text-emerald-700",
  planned: "bg-slate-100 text-slate-600 dark:bg-[#1a2148] dark:text-slate-300",
  candidate: "bg-amber-50 text-amber-700",
  verified: "bg-emerald-50 text-emerald-700",
};

export function StatusBadge({ status, isMock }: { status: string; isMock?: boolean }) {
  const label = status.startsWith("waiting") ? "waiting for approval" : status.replaceAll("_", " ");
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STYLES[status] ?? STYLES.queued}`}
      title={isMock ? "Development fixture output" : undefined}
    >
      {label}
      {isMock && (
        <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">DEV</span>
      )}
    </span>
  );
}
