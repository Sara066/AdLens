import { Card, Skeleton } from "./ui.jsx";

export default function KpiCard({ label, value, sub, icon: Icon, tone = "brand", loading }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600", sky: "bg-sky-50 text-sky-600", rose: "bg-rose-50 text-rose-600",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {Icon && <span className={`rounded-lg p-1.5 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>}
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-24" /> : <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>}
      {sub && !loading && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}
