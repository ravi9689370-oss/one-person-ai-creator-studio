"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV, NAV_ICONS } from "./nav-configs";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur transition-all lg:flex dark:border-[#232b4d] dark:bg-[#0d1330]/90",
        collapsed ? "w-[72px]" : "w-64",
      )}
      aria-label="Primary"
    >
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4 dark:border-[#232b4d]">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v6a1.5 1.5 0 0 1-1.5 1.5H10l-4 4v-4H5.5A1.5 1.5 0 0 1 4 13.5v-6Z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="9" cy="10.5" r="1.1" fill="white" />
              <circle cx="12.5" cy="10.5" r="1.1" fill="white" />
              <circle cx="16" cy="10.5" r="1.1" fill="white" />
            </svg>
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">
              AI Creator Studio
              <span className="block text-[10px] font-medium text-slate-500">One-Person Media OS</span>
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 text-[13px]">
        {NAV.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.children.map((leaf) => {
                const Icon = NAV_ICONS[leaf.icon ?? "Workflow"] ?? NAV_ICONS.Workflow;
                const active = pathname === leaf.href || (leaf.href !== "/dashboard" && pathname.startsWith(leaf.href + "/"));
                return (
                  <li key={leaf.href}>
                    <Link
                      href={leaf.href}
                      title={leaf.label}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-[#1a2148] dark:hover:text-white",
                        active && "bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white dark:bg-indigo-600",
                      )}
                    >
                      <Icon size={16} strokeWidth={2.1} className="shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{leaf.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-2 dark:border-[#232b4d]">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#1a2148]"
          aria-pressed={collapsed}
        >
          {collapsed ? "»" : "« Collapse"}
        </button>
      </div>
    </aside>
  );
}
