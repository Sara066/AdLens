import { Crown, Target } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client.js";
import { BarsChart } from "../components/charts.jsx";
import DataTable from "../components/DataTable.jsx";
import { Badge, Card, CardHeader, ErrorBox, Field, PageHeader, PlatformTag, Select, Spinner, Tabs } from "../components/ui.jsx";
import { useOptions } from "../context/OptionsContext.jsx";
import { int, money, pct, roas } from "../lib/format.js";
import { AudienceFields, defaultAudience } from "./Predict.jsx";

export default function Recommend() {
  const { options } = useOptions();
  const [form, setForm] = useState(defaultAudience());
  const [state, setState] = useState({ loading: false, error: "", data: null });
  const [tab, setTab] = useState("ranking");
  const [adId, setAdId] = useState("");
  const [adRes, setAdRes] = useState(null);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  if (!options) return <Spinner />;

  const run = async () => {
    setState({ loading: true, error: "", data: null }); setAdRes(null);
    try {
      setState({ loading: false, error: "", data: await api.post("/recommend", { ...form, top_n: 10 }) });
    } catch (e) {
      setState({ loading: false, error: e.message, data: null });
    }
  };

  const checkAd = async (id) => {
    setAdId(id);
    if (!id) return setAdRes(null);
    try { setAdRes(await api.post("/recommend/platform", { ...form, ad_id: id })); } catch (e) { setAdRes({ error: e.message }); }
  };

  const d = state.data;
  const rowCols = [
    { key: "rank", label: "#", render: (r) => <span className="font-semibold text-slate-400">{r.rank}</span> },
    { key: "ad_id", label: "Ad", render: (r) => <span className="font-medium text-slate-900">{r.ad_id}</span> },
    { key: "ad_type", label: "Type", render: (r) => <Badge tone="brand">{r.ad_type}</Badge> },
    { key: "platform", label: "Platform", render: (r) => <PlatformTag name={r.platform} /> },
    { key: "pred_ctr", label: "CTR", align: "right", render: (r) => pct(r.pred_ctr) },
    { key: "pred_cvr", label: "Conv. rate", align: "right", render: (r) => pct(r.pred_cvr) },
    { key: "expected_conversions", label: "Exp. conv.", align: "right", render: (r) => int(r.expected_conversions) },
    { key: "pred_roas", label: "Pred. ROAS", align: "right", render: (r) => <span className="font-semibold text-emerald-600">{roas(r.pred_roas)}</span> },
  ];

  return (
    <>
      <PageHeader title="Recommendations" subtitle="Pick a target audience and get the best advertisement and platform" />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader title="Target audience" />
          <div className="space-y-4 p-5">
            <AudienceFields form={form} set={set} options={options} />
            <button className="btn-primary w-full" onClick={run} disabled={state.loading}>
              <Target className="h-4 w-4" /> {state.loading ? "Analysing..." : "Get recommendation"}
            </button>
          </div>
        </Card>

        <div className="space-y-6">
          <ErrorBox message={state.error} hint={state.error.includes("not trained") ? "Run: python ml/train.py, then restart the API." : undefined} />
          {state.loading && <Spinner label="Scoring every ad on every platform..." />}
          {!d && !state.loading && !state.error && (
            <Card className="grid place-items-center p-12 text-center">
              <Target className="h-10 w-10 text-brand-300" />
              <p className="mt-3 font-medium text-slate-700">Choose an audience to see what works best</p>
              <p className="mt-1 max-w-sm text-sm text-slate-400">Every ad is scored on every platform and ranked by predicted ROAS.</p>
            </Card>
          )}
          {d && (
            <>
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-brand-600 to-brand-800 p-6 text-white">
                  <p className="flex items-center gap-2 text-sm font-medium text-brand-100"><Crown className="h-4 w-4" /> Best combination for this audience</p>
                  <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-3">
                    <div><p className="text-xs text-brand-200">Advertisement</p><p className="text-3xl font-semibold">{d.best.ad_id}</p>
                      <p className="text-xs text-brand-200">{d.best.ad_type} · {d.best.ad_category}</p></div>
                    <div><p className="text-xs text-brand-200">Platform</p><p className="text-3xl font-semibold">{d.best.platform}</p></div>
                    <div><p className="text-xs text-brand-200">Predicted ROAS</p><p className="text-3xl font-semibold">{roas(d.best.pred_roas)}</p></div>
                  </div>
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
                  <div className="p-4"><p className="label">CTR</p><p className="font-semibold">{pct(d.best.pred_ctr)}</p></div>
                  <div className="p-4"><p className="label">Conv. rate</p><p className="font-semibold">{pct(d.best.pred_cvr)}</p></div>
                  <div className="p-4"><p className="label">Exp. revenue</p><p className="font-semibold text-emerald-600">{money(d.best.expected_revenue)}</p></div>
                </div>
              </Card>

              <Tabs value={tab} onChange={setTab} tabs={[
                { value: "ranking", label: "Top combinations" }, { value: "platform", label: "Best ad per platform" }, { value: "ad", label: "Best platform for an ad" },
              ]} />

              {tab === "ranking" && <Card><DataTable rows={d.ranking} columns={rowCols} initialSort={{ key: "rank", dir: "asc" }} /></Card>}

              {tab === "platform" && (
                <div className="grid gap-6 xl:grid-cols-2">
                  <Card><CardHeader title="Predicted ROAS of each platform's best ad" />
                    <div className="p-4"><BarsChart data={d.best_by_platform} nameKey="platform" valueKey="pred_roas" colorBy="platform" format={(v) => `${Number(v).toFixed(1)}x`} /></div></Card>
                  <Card><DataTable dense rows={d.best_by_platform} columns={[
                    { key: "platform", label: "Platform", render: (r) => <PlatformTag name={r.platform} /> },
                    { key: "ad_id", label: "Best ad" },
                    { key: "pred_ctr", label: "CTR", align: "right", render: (r) => pct(r.pred_ctr) },
                    { key: "pred_roas", label: "ROAS", align: "right", render: (r) => roas(r.pred_roas) },
                  ]} /></Card>
                </div>
              )}

              {tab === "ad" && (
                <Card>
                  <CardHeader title="Where should a specific ad run?" subtitle="Uses the audience settings on the left" />
                  <div className="space-y-4 p-5">
                    <div className="max-w-sm"><Field label="Advertisement">
                      <Select value={adId} onChange={checkAd} placeholder="Select an ad" options={options.ads.map((a) => ({ value: a.ad_id, label: `${a.ad_id} · ${a.ad_type} · ${a.ad_category}` }))} />
                    </Field></div>
                    {adRes?.error && <ErrorBox message={adRes.error} />}
                    {adRes?.platforms && (
                      <>
                        <p className="text-sm text-slate-600">Best platform for <b>{adRes.ad_id}</b>: <PlatformTag name={adRes.best_platform} /></p>
                        <DataTable dense rows={adRes.platforms} columns={[
                          { key: "platform", label: "Platform", render: (r) => <PlatformTag name={r.platform} /> },
                          { key: "pred_ctr", label: "CTR", align: "right", render: (r) => pct(r.pred_ctr) },
                          { key: "pred_cvr", label: "Conv. rate", align: "right", render: (r) => pct(r.pred_cvr) },
                          { key: "pred_roas", label: "ROAS", align: "right", render: (r) => roas(r.pred_roas) },
                        ]} />
                      </>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
