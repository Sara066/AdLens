import { Empty } from "./ui.jsx";

/** rows/cols: label arrays, values: 2D array (null allowed), format: number -> string */
export default function Heatmap({ rows = [], cols = [], values = [], format = (v) => v.toFixed(2), highIsGood = true }) {
  const flat = values.flat().filter((v) => v !== null && v !== undefined);
  if (!flat.length) return <Empty />;
  const min = Math.min(...flat), max = Math.max(...flat);
  const shade = (v) => {
    if (v === null || v === undefined) return {};
    let t = max === min ? 0.5 : (v - min) / (max - min);
    if (!highIsGood) t = 1 - t;
    return { background: `rgba(79,70,229,${(0.06 + 0.84 * t).toFixed(2)})`, color: t > 0.55 ? "#fff" : "#1e1b4b" };
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th />
            {cols.map((c) => <th key={c} className="px-2 py-1 text-xs font-medium text-slate-500">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <th className="whitespace-nowrap pr-3 text-right text-xs font-medium text-slate-500">{r}</th>
              {cols.map((c, j) => {
                const v = values[i]?.[j];
                return (
                  <td key={c} style={shade(v)} className="rounded-md px-3 py-2.5 text-center font-medium tabular-nums">
                    {v === null || v === undefined ? "-" : format(v)}
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
