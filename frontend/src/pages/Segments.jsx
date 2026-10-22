import { useState } from "react";
import { api } from "../api/client.js";
import { BarsChart } from "../components/charts.jsx";
import DataTable from "../components/DataTable.jsx";
import FilterBar, { EMPTY_FILTERS } from "../components/FilterBar.jsx";
import Heatmap from "../components/Heatmap.jsx";
import { Card, CardHeader, Empty, ErrorBox, Field, PageHeader, Select, Skeleton } from "../components/ui.jsx";
import { useApi } from "../hooks/useApi.js";
import { int, money, pct, prettyLabel, roas } from "../lib/format.js";

const DIMS = ["segment", "age_group", "gender", "interest", "location_tier", "device"].map((d) => ({ value: d, label: prettyLabel(d) }));
const MAT_DIMS = ["age_group", "gender", "interest", "location_tier", "device", "platform", "ad_type", "ad_category"].map((d) => ({ value: d, label: prettyLabel(d) }));
const METRICS = [
  { value: "roas", label: "ROAS", f: (v) => `${v.toFixed(1)}x` },
  { value: "ctr", label: "CTR", f: (v) => `${(v * 100).toFixed(1)}%` },
  { value: "conversion_rate", label: "Conversion rate", f: (v) => `${(v * 100).toFixed(1)}%` },
  { value: "cpa", label: "CPA (lower is better)", f: (v) => `₹${Math.round(v)}` },
];

export default function Segments() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [dim, setDim] = useState("age_group");
  const [row, setRow] = useState("age_group");
  const [col, setCol] = useState("platform");
  const [metric, setMetric] = useState("roas");
  const dep = JSON.stringify(filters);

  const segs = useApi(() => api.get("/metrics/segments", { ...filters, dimension: dim, limit: 15 }), [dep, dim]);
  const mat = useApi(() => (row === col ? Promise.resolve(null) : api.get("/metrics/matrix", { ...filters, row, col, metric })), [dep, row, col, metric]);
  const m = METRICS.find((x) => x.value === metric);

  return (
    <>
      <PageHeader title="Customer segments" subtitle="Which audiences respond best, and where" />
      <FilterBar filters={filters} onChange={setFilters} show={["platform", "ad_type"]} />

      <Card>
        <CardHeader title="Performance by audience" subtitle="Top 15 by ROAS"
          action={<div className="w-44"><Select value={dim} onChange={setDim} options={DIMS} /></div>} />
        <ErrorBox message={segs.error} />
        <div className="grid gap-4 p-4 xl:grid-cols-2">
          {segs.loading ? <Skeleton className="h-72" /> : segs.data?.length ? (
            <BarsChart data={segs.data} nameKey={dim} valueKey="roas" horizontal height={Math.max(220, segs.data.length * 30)} format={(v) => `${Number(v).toFixed(1)}x`} color="#6366f1" />
          ) : <Empty />}
          <div className="max-h-[480px] overflow-y-auto">
            <DataTable dense rows={segs.data || []} initialSort={{ key: "roas", dir: "desc" }} columns={[
              { key: dim, label: prettyLabel(dim), render: (r) => <span className="font-medium text-slate-900">{r[dim]}</span> },
              { key: "spend", label: "Spend", align: "right", render: (r) => money(r.spend) },
              { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
              { key: "conversions", label: "Conv.", align: "right", render: (r) => int(r.conversions) },
              { key: "roas", label: "ROAS", align: "right", render: (r) => <span className="font-semibold text-emerald-600">{roas(r.roas)}</span> },
            ]} />
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Heatmap" subtitle="Compare two dimensions at once" />
        <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-3">
          <Field label="Rows"><Select value={row} onChange={setRow} options={MAT_DIMS} /></Field>
          <Field label="Columns"><Select value={col} onChange={setCol} options={MAT_DIMS} /></Field>
          <Field label="Metric"><Select value={metric} onChange={setMetric} options={METRICS} /></Field>
        </div>
        <div className="p-5">
          {row === col ? <Empty text="Choose two different dimensions." /> : mat.loading ? <Skeleton className="h-56" /> : mat.error ? <ErrorBox message={mat.error} /> :
            mat.data && <Heatmap rows={mat.data.rows} cols={mat.data.cols} values={mat.data.values} format={m.f} highIsGood={metric !== "cpa"} />}
        </div>
      </Card>
    </>
  );
}
