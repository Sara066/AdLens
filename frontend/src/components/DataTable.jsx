import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Empty } from "./ui.jsx";

/** columns: [{ key, label, align?, render?(row), sortable? (default true) }] */
export default function DataTable({ rows = [], columns, initialSort, maxRows, emptyText, onRowClick, dense }) {
  const [sort, setSort] = useState(initialSort || null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, sort]);

  const shown = maxRows ? sorted.slice(0, maxRows) : sorted;
  const toggle = (c) => {
    if (c.sortable === false) return;
    setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "desc" }));
  };

  if (!rows.length) return <Empty text={emptyText} />;
  const pad = dense ? "px-4 py-2" : "px-4 py-3";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th key={c.key} onClick={() => toggle(c)}
                className={`${pad} font-medium ${c.align === "right" ? "text-right" : "text-left"} ${c.sortable === false ? "" : "cursor-pointer select-none hover:text-slate-800"}`}>
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {shown.map((r, i) => (
            <tr key={r.id ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`hover:bg-slate-50 ${onRowClick ? "cursor-pointer" : ""}`}>
              {columns.map((c) => (
                <td key={c.key} className={`${pad} ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
