export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v6a1.5 1.5 0 0 1-1.5 1.5H10l-4 4v-4H5.5A1.5 1.5 0 0 1 4 13.5v-6Z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="9" cy="10.5" r="1.1" fill="white" />
          <circle cx="12.5" cy="10.5" r="1.1" fill="white" />
          <circle cx="16" cy="10.5" r="1.1" fill="white" />
        </svg>
      </span>
      {!compact && (
        <span className={`text-[15px] font-bold leading-tight ${dark ? "text-white" : "text-slate-900 dark:text-white"}`}>
          AI Creator Studio
          <span className={`block text-[10px] font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>
            The One-Person Media OS
          </span>
        </span>
      )}
    </div>
  );
}
