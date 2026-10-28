import Link from "next/link";

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: { label: string; href: string } | React.ReactNode;
  icon?: React.ReactNode;
}) {
  const linkAction =
    action && typeof action === "object" && "href" in (action as Record<string, unknown>)
      ? (action as { href: string; label: string })
      : null;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 dark:bg-[#1a2148] dark:text-indigo-300">
        {icon ?? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v11A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-11Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 12h6M9 8.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      {body && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{body}</p>}
      {action &&
        (linkAction ? (
          <Link href={linkAction.href} className="mt-4 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            {linkAction.label}
          </Link>
        ) : (
          <div className="mt-4">{action as React.ReactNode}</div>
        ))}
    </div>
  );
}

export function RequirementNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      {children}
    </div>
  );
}
