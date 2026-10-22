import { Activity, Eye, IndianRupee, MousePointerClick, Sparkles, Target, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { BarsChart, TrendChart } from "../components/charts.jsx";
import DataTable from "../components/DataTable.jsx";
import FilterBar, { EMPTY_FILTERS } from "../components/FilterBar.jsx";
import KpiCard from "../components/KpiCard.jsx";
import { Badge, Card, CardHeader, Empty, ErrorBox, PageHeader, PlatformTag, Skeleton, Tabs } from "../components/ui.jsx";
import { useApi } from "../hooks/useApi.js";
import { compactNum, int, money, pct, roas } from "../lib/format.js";

const SEG_TABS = [
  { value: "age_group", label: "Age" }, { value: "gender", label: "Gender" },
  { value: "interest", label: "Interest" }, { value: "location_tier", label: "Location" },
];

function Recommendation({ segmentName }) {
  const [age_group, gender, interest] = (segmentName || "").split(" | ");
  const { data, loading, error } = useApi(
    () => (age_group ? api.post("/recommend", { age_group, gender, interest, top_n: 1 }) : Promise.resolve(null)),
    [segmentName]
  );
  return (
    <Card className="flex flex-col">
      <CardHeader title="AI recommendation" subtitle={segmentName ? `Top-performing audience: ${segmentName}` : "Best opportunity right now"}
        action={<Sparkles className="h-4 w-4 text-brand-500" />} />
      <div className="flex-1 p-5">
        {loading && <Skeleton className="h-28 w-full" />}
        {error && <ErrorBox message={error} hint="Train the models first: python ml/train.py" />}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="label">Best ad</p><p className="text-xl font-semibold">{data.best.ad_id}</p>
                <p className="text-xs text-slate-500">{data.best.ad_type} · {data.best.ad_category}</p></div>
              <div><p className="label">Best platform</p><p className="mt-1"><PlatformTag name={data.best.platform} /></p></div>
            </div>
            <div className="mt-5 rounded-lg bg-brand-50 p-3">
              <p className="text-xs text-brand-700">Predicted ROAS</p>
              <p className="text-2xl font-semibold text-brand-700">{roas(data.best.pred_roas)}</p>
            </div>
            <Link to="/recommend" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">Try your own audience →</Link>
          </>
        )}
        {!loading && !error && !data && <Empty text="No data yet." />}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [segDim, setSegDim] = useState("age_group");
  const dep = JSON.stringify(filters);

  const summary = useApi(() => api.get("/metrics/summary", filters), [dep]);
  const platforms = useApi(() => api.get("/metrics/platforms", filters), [dep]);
  const trend = useApi(() => api.get("/metrics/trend", filters), [dep]);
  const segs = useApi(() => api.get("/metrics/segments", { ...filters, dimension: segDim, limit: 12 }), [dep, segDim]);
  const top = useApi(() => api.get("/metrics/top-ads", { ...filters, limit: 8 }), [dep]);

  const k = summary.data?.kpis;
  const loading = summary.loading;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Advertisement performance across all platforms" />
      <FilterBar filters={filters} onChange={setFilters} />
      <ErrorBox message={summary.error} hint="Check that the backend is running: uvicorn backend.app.main:app --reload" />

      <div className="mt-2 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard loading={loading} label="Campaigns" icon={Activity} value={k && int(k.campaigns)} sub={k && `${int(k.ads)} ads · ${int(k.flights)} flights`} />
        <KpiCard loading={loading} label="Ad spend" icon={Wallet} tone="amber" value={k && money(k.spend)} />
        <KpiCard loading={loading} label="Revenue" icon={IndianRupee} tone="green" value={k && money(k.revenue)} />
        <KpiCard loading={loading} label="Avg CTR" icon={MousePointerClick} tone="sky" value={k && pct(k.ctr)} sub={k && `${compactNum(k.clicks)} clicks`} />
        <KpiCard loading={loading} label="Conversions" icon={Eye} tone="rose" value={k && compactNum(k.conversions)} sub={k && `${pct(k.conversion_rate)} of clicks`} />
        <KpiCard loading={loading} label="ROAS" icon={TrendingUp} tone="green" value={k && roas(k.roas)} sub={k && `CPA ${money(k.cpa, false)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="ROAS by platform" subtitle="Revenue per rupee spent" />
          <div className="p-4">
            {platforms.loading ? <Skeleton className="h-64" /> : platforms.data?.length ? (
              <BarsChart data={platforms.data} nameKey="platform" valueKey="roas" colorBy="platform" format={(v) => `${Number(v).toFixed(1)}x`} />
            ) : <Empty />}
          </div>
        </Card>
        <Recommendation segmentName={summary.data?.best?.segment?.name} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue and spend trend" subtitle="By campaign launch month" />
          <div className="p-4">
            {trend.loading ? <Skeleton className="h-64" /> : trend.data?.length ? (
              <TrendChart data={trend.data} lines={[{ key: "revenue", label: "Revenue", color: "#4f46e5" }, { key: "spend", label: "Spend", color: "#f59e0b" }]} />
            ) : <Empty />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Customer segment performance" subtitle="ROAS by audience"
            action={<Tabs tabs={SEG_TABS} value={segDim} onChange={setSegDim} />} />
          <div className="p-4">
            {segs.loading ? <Skeleton className="h-64" /> : segs.data?.length ? (
              <BarsChart data={segs.data} nameKey={segDim} valueKey="roas" format={(v) => `${Number(v).toFixed(1)}x`} color="#6366f1" />
            ) : <Empty />}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Top performing advertisements" subtitle="Ranked by ROAS" />
        {top.loading ? <div className="p-4"><Skeleton className="h-40" /></div> : (
          <DataTable rows={top.data || []} initialSort={{ key: "roas", dir: "desc" }} columns={[
            { key: "ad_id", label: "Ad", render: (r) => <span className="font-medium text-slate-900">{r.ad_id}</span> },
            { key: "ad_type", label: "Type", render: (r) => <Badge tone="brand">{r.ad_type}</Badge> },
            { key: "ad_category", label: "Category" },
            { key: "spend", label: "Spend", align: "right", render: (r) => money(r.spend) },
            { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
            { key: "conversion_rate", label: "Conv. rate", align: "right", render: (r) => pct(r.conversion_rate) },
            { key: "roas", label: "ROAS", align: "right", render: (r) => <span className="font-semibold text-emerald-600">{roas(r.roas)}</span> },
          ]} />
        )}
      </Card>
      <p className="mt-4 text-xs text-slate-400">All ratios are spend-weighted · Data is synthetic, generated for this project.</p>
    </>
  );
}
