import { X } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client.js";
import { BarsChart, GroupedBars } from "../components/charts.jsx";
import DataTable from "../components/DataTable.jsx";
import FilterBar, { EMPTY_FILTERS } from "../components/FilterBar.jsx";
import Heatmap from "../components/Heatmap.jsx";
import { Badge, Card, CardHeader, Empty, ErrorBox, PageHeader, PlatformTag, Select, Skeleton, Tabs } from "../components/ui.jsx";
import { useOptions } from "../context/OptionsContext.jsx";
import { useApi } from "../hooks/useApi.js";
import { SERIES } from "../lib/colors.js";
import { int, money, pct, roas } from "../lib/format.js";

function PlatformCompare() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const { data, loading, error } = useApi(() => api.get("/compare/platforms", filters), [JSON.stringify(filters)]);
  const plats = data?.platforms || [];

  // ad type x platform ROAS heatmap
  const typeRows = [...new Set((data?.by_ad_type || []).map((r) => r.ad_type))].sort();
  const platCols = plats.map((p) => p.platform).sort();
  const lookup = Object.fromEntries((data?.by_ad_type || []).map((r) => [`${r.ad_type}|${r.platform}`, r.roas]));
  const values = typeRows.map((t) => platCols.map((p) => lookup[`${t}|${p}`] ?? null));

  const mini = [
    { key: "ctr", title: "CTR", f: (v) => `${(v * 100).toFixed(1)}%` },
    { key: "conversion_rate", title: "Conversion rate", f: (v) => `${(v * 100).toFixed(1)}%` },
    { key: "roas", title: "ROAS", f: (v) => `${Number(v).toFixed(1)}x` },
  ];

  return (
    <>
      <FilterBar filters={filters} onChange={setFilters} show={["ad_type", "age_group", "gender", "interest"]} />
      <ErrorBox message={error} />
      {data?.best_platform && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Best platform for these filters: <PlatformTag name={data.best_platform} /> <span>({roas(plats[0].roas)} ROAS)</span>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        {mini.map((m) => (
          <Card key={m.key}>
            <CardHeader title={m.title} />
            <div className="p-4">{loading ? <Skeleton className="h-52" /> : plats.length ? <BarsChart data={plats} nameKey="platform" valueKey={m.key} colorBy="platform" format={m.f} height={210} /> : <Empty />}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader title="Platform details" />
        <DataTable rows={plats} initialSort={{ key: "roas", dir: "desc" }} columns={[
          { key: "platform", label: "Platform", render: (r) => <PlatformTag name={r.platform} /> },
          { key: "spend", label: "Spend", align: "right", render: (r) => money(r.spend) },
          { key: "revenue", label: "Revenue", align: "right", render: (r) => money(r.revenue) },
          { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
          { key: "conversions", label: "Conversions", align: "right", render: (r) => int(r.conversions) },
          { key: "conversion_rate", label: "Conv. rate", align: "right", render: (r) => pct(r.conversion_rate) },
          { key: "cpa", label: "CPA", align: "right", render: (r) => money(r.cpa, false) },
          { key: "roas", label: "ROAS", align: "right", render: (r) => <span className="font-semibold text-emerald-600">{roas(r.roas)}</span> },
        ]} />
      </Card>
      <Card className="mt-6">
        <CardHeader title="Which ad type works where?" subtitle="ROAS by ad type and platform" />
        <div className="p-5"><Heatmap rows={typeRows} cols={platCols} values={values} format={(v) => `${v.toFixed(1)}x`} /></div>
      </Card>
    </>
  );
}

function AdCompare() {
  const { options } = useOptions();
  const [picked, setPicked] = useState([]);
  const ready = picked.length >= 2;
  const { data, loading, error } = useApi(() => (ready ? api.get("/compare/ads", { ad_ids: picked }) : Promise.resolve(null)), [picked.join(",")]);

  const add = (id) => id && !picked.includes(id) && picked.length < 6 && setPicked([...picked, id]);
  const adInfo = (id) => options?.ads.find((a) => a.ad_id === id);

  const platforms = [...new Set((data?.by_platform || []).map((r) => r.platform))].sort();
  const chart = platforms.map((p) => ({
    platform: p, ...Object.fromEntries(picked.map((id) => [id, data.by_platform.find((r) => r.ad_id === id && r.platform === p)?.roas ?? 0])),
  }));

  return (
    <>
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-72">
            <Select value="" onChange={add} placeholder={picked.length >= 6 ? "Maximum 6 ads" : "Add an ad to compare..."}
              options={(options?.ads || []).filter((a) => !picked.includes(a.ad_id)).map((a) => ({ value: a.ad_id, label: `${a.ad_id} · ${a.ad_type} · ${a.ad_category}` }))} />
          </div>
          {picked.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-sm font-medium text-brand-700">
              {id} <span className="text-xs font-normal text-brand-400">{adInfo(id)?.ad_type}</span>
              <button className="rounded-full p-0.5 hover:bg-brand-100" onClick={() => setPicked(picked.filter((p) => p !== id))}><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
        {!ready && <p className="mt-3 text-sm text-slate-400">Pick at least two advertisements.</p>}
      </Card>
      <ErrorBox message={error} />
      {ready && (loading ? <Skeleton className="h-80" /> : data && (
        <>
          <Card>
            <CardHeader title="Overall comparison" />
            <DataTable rows={data.ads} initialSort={{ key: "roas", dir: "desc" }} columns={[
              { key: "ad_id", label: "Ad", render: (r) => <span className="font-medium text-slate-900">{r.ad_id}</span> },
              { key: "type", label: "Type", sortable: false, render: (r) => <Badge tone="brand">{adInfo(r.ad_id)?.ad_type}</Badge> },
              { key: "spend", label: "Spend", align: "right", render: (r) => money(r.spend) },
              { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
              { key: "conversion_rate", label: "Conv. rate", align: "right", render: (r) => pct(r.conversion_rate) },
              { key: "conversions", label: "Conversions", align: "right", render: (r) => int(r.conversions) },
              { key: "roas", label: "ROAS", align: "right", render: (r) => <span className="font-semibold text-emerald-600">{roas(r.roas)}</span> },
            ]} />
          </Card>
          <Card className="mt-6">
            <CardHeader title="ROAS by platform" subtitle="How each ad performs on each platform" />
            <div className="p-4"><GroupedBars data={chart} nameKey="platform" series={picked.map((id, i) => ({ key: id, color: SERIES[i % SERIES.length] }))} format={(v) => `${Number(v).toFixed(1)}x`} /></div>
          </Card>
        </>
      ))}
    </>
  );
}

export default function Compare() {
  const [tab, setTab] = useState("platforms");
  return (
    <>
      <PageHeader title="Compare" subtitle="See what performs better - across platforms or between advertisements"
        actions={<Tabs value={tab} onChange={setTab} tabs={[{ value: "platforms", label: "Platforms" }, { value: "ads", label: "Advertisements" }]} />} />
      {tab === "platforms" ? <PlatformCompare /> : <AdCompare />}
    </>
  );
}
