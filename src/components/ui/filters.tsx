import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterPill = { label: string; href: string; active?: boolean };

/** Server-renderable filter pill row (uses querystring links). */
export function FilterPills({ base, param, current, options }: { base: string; param: string; current?: string; options: { value: string; label: string }[] }) {
  const pills: FilterPill[] = options.map((o) => ({
    label: o.label,
    href: `${base}?${param}=${encodeURIComponent(o.value)}`,
    active: (current ?? options[0]?.value) === o.value,
  }));
  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition",
            p.active
              ? "bg-indigo-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 dark:border-[#2c3560] dark:bg-[#16204a] dark:text-slate-300",
          )}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}

export function param(v: string | string[] | undefined | null): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v && v.length > 0 ? v : undefined;
}
