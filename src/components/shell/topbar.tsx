"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Bell, Menu, Moon, Search, Sun, X } from "lucide-react";
import { NAV, NAV_ICONS } from "./nav-configs";

type Props = {
  workspaceName: string;
  userName: string;
  userEmail: string;
  unreadCount: number;
  briefTime: string;
};

export function Topbar({ workspaceName, userName, userEmail, unreadCount, briefTime }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [q, setQ] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(unreadCount);
  const [releases, setReleases] = useState<{ id: string; title: string; link: string | null; createdAt: string; type: string }[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("oc-theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!bellOpen) return;
    fetch("/api/notifications?type=recent&limit=8")
      .then((r) => r.json())
      .then((d: { items?: { id: string; title: string; link: string | null; createdAt: string; type: string }[] }) => {
        if (alive) setReleases(d.items ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [bellOpen]);

  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur sm:px-5 dark:border-[#232b4d] dark:bg-[#0d1330]/85">
      <button
        type="button"
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-[#1a2148]"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13px] text-slate-500 md:flex dark:text-slate-400">
        <Link href="/dashboard" className="font-medium text-slate-700 hover:underline dark:text-slate-200">{workspaceName}</Link>
        {crumbs.slice(0, crumbs.length).map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden>/</span>
            <span className="truncate capitalize">{c.replace(/-/g, " ")}</span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <form
          className="hidden sm:block"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
          role="search"
        >
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              aria-label="Global search"
              placeholder="Search everything…"
              className="w-44 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:w-64 focus:border-indigo-400 focus:bg-white dark:border-[#2c3560] dark:bg-[#131a3a] dark:focus:bg-[#131a3a] lg:w-56"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </form>

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1a2148]"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setBellOpen((o) => !o)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1a2148]"
            aria-label={`Notifications (${unread} unread)`}
          >
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-12 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop dark:border-[#2c3560] dark:bg-[#131a3a]">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500 dark:border-[#232b4d]">
                Notifications
                <Link href="/dashboard/notifications" className="text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => setBellOpen(false)}>
                  View all
                </Link>
              </div>
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-[#232b4d]">
                {releases.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</li>}
                {releases.map((n) => (
                  <li key={n.id}>
                    <Link href={n.link ?? "/dashboard/notifications"} className="block px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-[#1a2148]" onClick={() => setBellOpen(false)}>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{n.title}</span>
                      <span className="block text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-[#232b4d]">
                Daily briefing is scheduled for {briefTime}.
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-slate-100 dark:hover:bg-[#1a2148]"
            aria-label="Account menu"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
              {userName.slice(0, 2).toUpperCase()}
            </span>
            <span className="hidden text-sm font-medium text-slate-700 sm:block dark:text-slate-200">{userName}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-pop dark:border-[#2c3560] dark:bg-[#131a3a]">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-[#232b4d]">
                <p className="font-medium text-slate-800 dark:text-slate-100">{userName}</p>
                <p className="truncate text-xs text-slate-400">{userEmail}</p>
              </div>
              <Link href="/settings/briefing" className="block px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#1a2148]" onClick={() => setMenuOpen(false)}>
                Settings · Briefing
              </Link>
              <Link href="/integrations" className="block px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#1a2148]" onClick={() => setMenuOpen(false)}>
                Integrations
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full border-t border-slate-100 px-4 py-2.5 text-left text-rose-600 hover:bg-rose-50 dark:border-[#232b4d] dark:text-rose-400 dark:hover:bg-[#2a1025]"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {mobileOpen && <MobileDrawer onClose={() => setMobileOpen(false)} />}
    </header>
  );
}

function MobileDrawer({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-2xl dark:bg-[#0d1330]">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-[#232b4d]">
          <span className="text-sm font-bold text-slate-900 dark:text-white">AI Creator Studio</span>
          <button type="button" onClick={onClose} aria-label="Close navigation" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-[#1a2148]">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4 text-sm">
          <Link href="/search" className="block" onClick={onClose}>
            <span className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-slate-500 dark:border-[#2c3560]">
              <Search size={15} /> Search everything
            </span>
          </Link>
          {NAV.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{group.label}</p>
              <ul className="space-y-0.5">
                {group.children.map((leaf) => {
                  const Icon = NAV_ICONS[leaf.icon ?? "Workflow"] ?? NAV_ICONS.Workflow;
                  const active = pathname === leaf.href;
                  return (
                    <li key={leaf.href}>
                      <Link
                        href={leaf.href}
                        onClick={onClose}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 font-medium ${active ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1a2148]"}`}
                      >
                        <Icon size={16} /> {leaf.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
