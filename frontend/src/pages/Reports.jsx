import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import FilterBar, { EMPTY_FILTERS } from "../components/FilterBar.jsx";
import KpiCard from "../components/KpiCard.jsx";
import { Card, CardHeader, ErrorBox, PageHeader, PlatformTag, Skeleton } from "../components/ui.jsx";
import { useApi } from "../hooks/useApi.js";
import { compactNum, int, money, pct, roas } from "../lib/format.js";

export default function Reports() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [dlError, setDlError] = useState("");
  const { data, loading, error } = useApi(() => api.get("/reports/campaigns", filters), [JSON.stringify(filters)]);
  const t = data?.totals;

  const download = async () => {
    setDlError("");
    try { await api.download("/reports/campaigns.csv", filters, "campaign_report.csv"); } catch (e) { setDlError(e.message); }
  };
  const period = filters.date_from || filters.date_to ? `${filters.date_from || "start"} to ${filters.date_to || "today"}` : "All time";

  return (
    <>
      <PageHeader title="Campaign report" subtitle={`Period: ${period}`}
        actions={<>
          <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</button>
          <button className="btn-primary" onClick={download}><Download className="h-4 w-4" /> Export CSV</button>
        </>} />
      <FilterBar filters={filters} onChange={setFilters} show={["campaign_id", "platform", "ad_type"]} />
      <ErrorBox message={error || dlError} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard loading={loading} label="Total spend" tone="amber" value={t && money(t.spend)} />
        <KpiCard loading={loading} label="Total revenue" tone="green" value={t && money(t.revenue)} />
        <KpiCard loading={loading} label="ROAS" value={t && roas(t.roas)} sub={t && `CTR ${pct(t.ctr)}`} />
        <KpiCard loading={loading} label="Conversions" tone="rose" value={t && compactNum(t.conversions)} sub={t && `CPA ${money(t.cpa, false)}`} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Campaigns" subtitle="Click a column to sort" />
        {loading ? <div className="p-4"><Skeleton className="h-48" /></div> : (
          <DataTable rows={data?.campaigns || []} initialSort={{ key: "roas", dir: "desc" }} columns={[
            { key: "campaign_id", label: "Campaign", render: (r) => <span className="font-medium text-slate-900">{r.campaign_id}</span> },
            { key: "flights", label: "Flights", align: "right" },
            { key: "spend", label: "Spend", align: "right", render: (r) => money(r.spend) },
            { key: "revenue", label: "Revenue", align: "right", render: (r) => money(r.revenue) },
            { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
            { key: "conversions", label: "Conversions", align: "right", render: (r) => int(r.conversions) },
            { key: "conversion_rate", label: "Conv. rate", align: "right", render: (r) => pct(r.conversion_rate) },
            { key: "roas", label: "ROAS", align: "right", render: (r) => <span className="font-semibold text-emerald-600">{roas(r.roas)}</span> },
          ]} />
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="By platform" />
          <DataTable dense rows={data?.by_platform || []} initialSort={{ key: "roas", dir: "desc" }} columns={[
            { key: "platform", label: "Platform", render: (r) => <PlatformTag name={r.platform} /> },
            { key: "spend", label: "Spend", align: "right", render: (r) => money(r.spend) },
            { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
            { key: "roas", label: "ROAS", align: "right", render: (r) => roas(r.roas) },
          ]} />
        </Card>
        <Card>
          <CardHeader title="Top 5 advertisements" />
          <DataTable dense rows={data?.top_ads || []} initialSort={{ key: "roas", dir: "desc" }} columns={[
            { key: "ad_id", label: "Ad" },
            { key: "spend", label: "Spend", align: "right", render: (r) => money(r.spend) },
            { key: "ctr", label: "CTR", align: "right", render: (r) => pct(r.ctr) },
            { key: "roas", label: "ROAS", align: "right", render: (r) => roas(r.roas) },
          ]} />
        </Card>
      </div>
    </>
  );
}
