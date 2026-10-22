import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { platformColor, SERIES } from "../lib/colors.js";
import { compactNum } from "../lib/format.js";

const axis = { fontSize: 12, fill: "#64748b" };
const grid = <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />;
const tip = { contentStyle: { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }, cursor: { fill: "rgba(99,102,241,0.06)" } };

/** One bar per row. colorBy="platform" uses brand colours, otherwise a single colour. */
export function BarsChart({ data, nameKey, valueKey, format = (v) => v, height = 260, colorBy, color = "#4f46e5", horizontal }) {
  const fill = (d) => (colorBy ? platformColor(d[colorBy]) : color);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 24 : 0, right: 12, top: 8 }}>
        {grid}
        {horizontal ? (
          <>
            <XAxis type="number" tick={axis} tickFormatter={format} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={nameKey} tick={axis} width={110} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey={nameKey} tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} tickFormatter={format} axisLine={false} tickLine={false} width={48} />
          </>
        )}
        <Tooltip {...tip} formatter={(v) => [format(v), valueKey]} />
        <Bar dataKey={valueKey} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={44}>
          {data.map((d, i) => <Cell key={i} fill={fill(d)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Several series side by side. series: [{key,label}] ; colours from SERIES or platform colours. */
export function GroupedBars({ data, nameKey, series, format = (v) => v, height = 280 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ right: 12, top: 8 }}>
        {grid}
        <XAxis dataKey={nameKey} tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} tickFormatter={format} axisLine={false} tickLine={false} width={48} />
        <Tooltip {...tip} formatter={(v, n) => [format(v), n]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label || s.key} fill={s.color || SERIES[i % SERIES.length]} radius={[4, 4, 0, 0]} maxBarSize={32} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data, lines, format = compactNum, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ right: 12, top: 8 }}>
        {grid}
        <XAxis dataKey="period" tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={axis} tickFormatter={format} axisLine={false} tickLine={false} width={48} />
        <Tooltip {...tip} formatter={(v, n) => [format(v), n]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {lines.map((l, i) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color || SERIES[i]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
