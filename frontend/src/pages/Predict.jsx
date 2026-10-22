import { Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client.js";
import { GroupedBars } from "../components/charts.jsx";
import DataTable from "../components/DataTable.jsx";
import { Badge, Card, CardHeader, Delta, ErrorBox, Field, PageHeader, PlatformTag, Select, Spinner } from "../components/ui.jsx";
import { useOptions } from "../context/OptionsContext.jsx";
import { useApi } from "../hooks/useApi.js";
import { int, money, MONTHS, pct, roas } from "../lib/format.js";

export function AudienceFields({ form, set, options }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age group"><Select value={form.age_group} onChange={set("age_group")} options={options.age_groups} /></Field>
        <Field label="Gender"><Select value={form.gender} onChange={set("gender")} options={options.genders} /></Field>
      </div>
      <Field label="Interest"><Select value={form.interest} onChange={set("interest")} options={options.interests} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Device"><Select value={form.device} onChange={set("device")} options={options.devices} /></Field>
        <Field label="Location"><Select value={form.location_tier} onChange={set("location_tier")} options={options.location_tiers} /></Field>
      </div>
      <Field label={`Budget: ${money(form.budget, false)}`}>
        <input type="range" className="w-full accent-brand-600" min={5000} max={500000} step={5000}
          value={form.budget} onChange={(e) => set("budget")(Number(e.target.value))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (days)"><input type="number" min={1} max={90} className="input" value={form.duration_days} onChange={(e) => set("duration_days")(Number(e.target.value))} /></Field>
        <Field label="Launch month"><Select value={form.month} onChange={(v) => set("month")(Number(v))} options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} /></Field>
      </div>
    </>
  );
}

export const defaultAudience = () => ({
  age_group: "25-34", gender: "Female", interest: "Fashion", device: "Mobile", location_tier: "Metro",
  budget: 50000, duration_days: 14, month: new Date().getMonth() + 1,
});

function Metric({ label, value, sub, baseline, raw }) {
  return (
    <Card className="p-5">
      <p className="label">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      <div className="mt-1 min-h-[1rem]"><Delta value={raw} baseline={baseline} /></div>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

export default function Predict() {
  const { options } = useOptions();
  const [form, setForm] = useState({ ad_id: "", platform: "Instagram", ...defaultAudience() });
  const [state, setState] = useState({ loading: false, error: "", result: null });
  const [refresh, setRefresh] = useState(0);
  const history = useApi(() => api.get("/predict/history", { limit: 8 }), [refresh]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  if (!options) return <Spinner />;
  const adId = form.ad_id || options.ads[0]?.ad_id;
  const ad = options.ads.find((a) => a.ad_id === adId);

  const run = async () => {
    setState({ loading: true, error: "", result: null });
    try {
      const result = await api.post("/predict", { ...form, ad_id: adId });
      setState({ loading: false, error: "", result });
      setRefresh((n) => n + 1);
    } catch (e) {
      setState({ loading: false, error: e.message, result: null });
    }
  };

  const r = state.result;
  const pa = r?.benchmark.platform_average, oa = r?.benchmark.overall_average;
  const compare = r && [
    { name: "Predicted", ROAS: r.prediction.roas },
    { name: `${form.platform} avg`, ROAS: pa.roas },
    { name: "Overall avg", ROAS: oa.roas },
  ];

  return (
    <>
      <PageHeader title="Performance prediction" subtitle="Estimate CTR, conversion rate and ROAS before you spend the budget" />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader title="Campaign setup" />
          <div className="space-y-4 p-5">
            <Field label="Advertisement" hint={ad ? `${ad.ad_type} · ${ad.ad_category}${ad.has_offer ? " · with offer" : ""}` : ""}>
              <Select value={adId} onChange={set("ad_id")} options={options.ads.map((a) => ({ value: a.ad_id, label: `${a.ad_id} · ${a.ad_type} · ${a.ad_category}` }))} />
            </Field>
            <Field label="Platform"><Select value={form.platform} onChange={set("platform")} options={options.platforms} /></Field>
            <AudienceFields form={form} set={set} options={options} />
            <button className="btn-primary w-full" onClick={run} disabled={state.loading}>
              <Sparkles className="h-4 w-4" /> {state.loading ? "Predicting..." : "Predict performance"}
            </button>
          </div>
        </Card>

        <div className="space-y-6">
          <ErrorBox message={state.error} hint={state.error.includes("not trained") ? "Run: python ml/train.py, then restart the API." : undefined} />
          {!r && !state.error && (
            <Card className="grid place-items-center p-12 text-center">
              <Sparkles className="h-10 w-10 text-brand-300" />
              <p className="mt-3 font-medium text-slate-700">Set up a campaign and press Predict</p>
              <p className="mt-1 max-w-sm text-sm text-slate-400">The model compares your ad, platform and audience with historical campaign data.</p>
            </Card>
          )}
          {r && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric label="Predicted CTR" value={pct(r.prediction.ctr)} raw={r.prediction.ctr} baseline={pa.ctr} />
                <Metric label="Conversion rate" value={pct(r.prediction.conversion_rate)} raw={r.prediction.conversion_rate} baseline={pa.conversion_rate} />
                <Metric label="Predicted ROAS" value={roas(r.prediction.roas)} raw={r.prediction.roas} baseline={pa.roas} sub={`Break-even is 1.0x`} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="p-5"><p className="label">Expected clicks</p><p className="text-xl font-semibold">{int(r.prediction.expected_clicks)}</p></Card>
                <Card className="p-5"><p className="label">Expected conversions</p><p className="text-xl font-semibold">{int(r.prediction.expected_conversions)}</p></Card>
                <Card className="p-5"><p className="label">Expected revenue</p><p className="text-xl font-semibold text-emerald-600">{money(r.prediction.expected_revenue)}</p></Card>
              </div>
              <Card>
                <CardHeader title="ROAS vs historical averages" subtitle="Comparison uses the same platform's past performance" />
                <div className="p-4"><GroupedBars data={compare} nameKey="name" series={[{ key: "ROAS", color: "#4f46e5" }]} format={(v) => `${Number(v).toFixed(1)}x`} height={220} /></div>
              </Card>
              <p className="text-xs text-slate-400">{r.note}</p>
            </>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Your recent predictions" />
        <DataTable rows={(history.data || []).map((h) => ({ ...h, id: h.prediction_id }))} emptyText="No predictions yet." columns={[
          { key: "ad_id", label: "Ad", render: (h) => <Badge tone="brand">{h.ad_id}</Badge> },
          { key: "platform", label: "Platform", render: (h) => <PlatformTag name={h.platform} /> },
          { key: "budget", label: "Budget", align: "right", render: (h) => money(h.budget, false) },
          { key: "ctr", label: "CTR", align: "right", render: (h) => pct(h.ctr) },
          { key: "conversion_rate", label: "Conv.", align: "right", render: (h) => pct(h.conversion_rate) },
          { key: "roas", label: "ROAS", align: "right", render: (h) => roas(h.roas) },
          { key: "date", label: "When", align: "right", render: (h) => new Date(h.date + "Z").toLocaleString() },
        ]} />
      </Card>
    </>
  );
}
