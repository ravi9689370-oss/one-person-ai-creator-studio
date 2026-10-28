import { cn } from "@/lib/utils";

export type Column<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
};

/** Light server-rendered table with responsive column hiding. */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty,
  rowHref,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: React.ReactNode;
  rowHref?: (row: T) => string;
}) {
  if (rows.length === 0 && empty !== undefined) {
    return <>{empty}</>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400 dark:border-[#232b4d]">
            {columns.map((c, i) => (
              <th key={i} className={cn("px-4 py-2.5 font-semibold", c.className, c.hideOnMobile && "hidden md:table-cell")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#1d254d]">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn("align-middle", rowHref && "cursor-pointer transition hover:bg-slate-50 dark:hover:bg-[#1a2148]")}
            >
              {columns.map((c, i) => {
                const content = c.render(row);
                return (
                  <td key={i} className={cn("px-4 py-3", c.className, c.hideOnMobile && "hidden md:table-cell")}>
                    {typeof content === "string" ? content : content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
