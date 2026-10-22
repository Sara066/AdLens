import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { platformColor } from "../lib/colors.js";

export function Card({ className = "", children }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** options: ["A","B"] or [{value,label}]. `placeholder` adds an empty "All" option. */
export function Select({ value, onChange, options = [], placeholder, className = "" }) {
  return (
    <select className={`input ${className}`} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === "object" ? o.value : o;
        const l = typeof o === "object" ? o.label : o;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

export function ErrorBox({ message, hint }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{message}</p>
        {hint && <p className="mt-0.5 text-red-600/80">{hint}</p>}
      </div>
    </div>
  );
}

export function Empty({ text = "No data for the selected filters.", icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-400">
      <Icon className="h-8 w-8" /> {text}
    </div>
  );
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700", brand: "bg-brand-50 text-brand-700",
    green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function PlatformTag({ name }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: platformColor(name) }} />
      {name}
    </span>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="no-print inline-flex rounded-lg border border-slate-200 bg-slate-100/70 p-1">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            value === t.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Shows "+12.3% vs average" style comparison. higherIsBetter controls the colour. */
export function Delta({ value, baseline, higherIsBetter = true }) {
  if (!baseline) return null;
  const change = (value - baseline) / baseline;
  const good = higherIsBetter ? change >= 0 : change <= 0;
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
      {change >= 0 ? "▲" : "▼"} {Math.abs(change * 100).toFixed(0)}% vs average
    </span>
  );
}
