import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client.js";
import DataTable from "../components/DataTable.jsx";
import { Badge, Card, CardHeader, ErrorBox, Field, PageHeader, Select, Skeleton, Tabs } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useApi } from "../hooks/useApi.js";
import { pct } from "../lib/format.js";

function useAction() {
  const [msg, setMsg] = useState({ type: "", text: "" });
  const run = async (fn, okText) => {
    setMsg({ type: "", text: "" });
    try { await fn(); setMsg({ type: "ok", text: okText }); return true; }
    catch (e) { setMsg({ type: "err", text: e.message }); return false; }
  };
  return [msg, run];
}

function Notice({ msg }) {
  if (!msg.text) return null;
  return msg.type === "err" ? <ErrorBox message={msg.text} /> :
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">{msg.text}</div>;
}

/* ---------------- Users ---------------- */
function Users() {
  const { user: me } = useAuth();
  const [n, setN] = useState(0);
  const { data, loading, error } = useApi(() => api.get("/admin/users"), [n]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Analyst" });
  const [msg, run] = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    if (await run(() => api.post("/admin/users", form), "User created.")) { setForm({ name: "", email: "", password: "", role: "Analyst" }); setN(n + 1); }
  };
  const remove = async (u) => {
    if (window.confirm(`Delete ${u.name}?`) && await run(() => api.del(`/admin/users/${u.user_id}`), "User deleted.")) setN(n + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Users" />
        <ErrorBox message={error} />
        {loading ? <div className="p-4"><Skeleton className="h-40" /></div> : (
          <DataTable rows={(data || []).map((u) => ({ ...u, id: u.user_id }))} columns={[
            { key: "name", label: "Name", render: (u) => <span className="font-medium text-slate-900">{u.name}</span> },
            { key: "email", label: "Email" },
            { key: "role", label: "Role", render: (u) => <Badge tone={u.role === "Admin" ? "amber" : "brand"}>{u.role}</Badge> },
            { key: "x", label: "", sortable: false, align: "right", render: (u) => u.user_id === me.user_id ? <span className="text-xs text-slate-400">You</span> :
              <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(u)}><Trash2 className="h-4 w-4" /></button> },
          ]} />
        )}
      </Card>
      <Card>
        <CardHeader title="Add user" />
        <form onSubmit={add} className="space-y-3 p-5">
          <Field label="Name"><input className="input" required value={form.name} onChange={set("name")} /></Field>
          <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set("email")} /></Field>
          <Field label="Password"><input className="input" type="password" required minLength={6} value={form.password} onChange={set("password")} /></Field>
          <Field label="Role"><select className="input" value={form.role} onChange={set("role")}><option>Analyst</option><option>Manager</option><option>Admin</option></select></Field>
          <Notice msg={msg} />
          <button className="btn-primary w-full"><Plus className="h-4 w-4" /> Create user</button>
        </form>
      </Card>
    </div>
  );
}

/* ---------------- Ads ---------------- */
const EMPTY_AD = { ad_id: "", campaign_id: "", ad_type: "Image", ad_category: "Fashion", has_offer: 0 };

function Ads() {
  const [n, setN] = useState(0);
  const { data, loading, error } = useApi(() => api.get("/meta/options"), [n]);
  const [form, setForm] = useState(EMPTY_AD);
  const [editing, setEditing] = useState(null);
  const [msg, run] = useAction();
  const set = (k) => (v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    const ok = editing
      ? await run(() => api.put(`/admin/ads/${editing}`, { campaign_id: form.campaign_id, ad_type: form.ad_type, ad_category: form.ad_category, has_offer: Number(form.has_offer) }), "Ad updated.")
      : await run(() => api.post("/admin/ads", { ...form, has_offer: Number(form.has_offer) }), "Ad added.");
    if (ok) { setForm(EMPTY_AD); setEditing(null); setN(n + 1); }
  };
  const edit = (a) => { setEditing(a.ad_id); setForm({ ...a }); };
  const remove = async (a) => {
    if (window.confirm(`Delete ${a.ad_id}?`) && await run(() => api.del(`/admin/ads/${a.ad_id}`), "Ad deleted.")) setN(n + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Advertisements" subtitle="Ads with performance records cannot be deleted" />
        <ErrorBox message={error} />
        {loading ? <div className="p-4"><Skeleton className="h-40" /></div> : (
          <div className="max-h-[560px] overflow-y-auto">
            <DataTable dense rows={(data?.ads || []).map((a) => ({ ...a, id: a.ad_id }))} initialSort={{ key: "ad_id", dir: "asc" }} columns={[
              { key: "ad_id", label: "Ad", render: (a) => <span className="font-medium text-slate-900">{a.ad_id}</span> },
              { key: "campaign_id", label: "Campaign" },
              { key: "ad_type", label: "Type" },
              { key: "ad_category", label: "Category" },
              { key: "has_offer", label: "Offer", render: (a) => (a.has_offer ? <Badge tone="green">Yes</Badge> : <span className="text-slate-400">No</span>) },
              { key: "x", label: "", sortable: false, align: "right", render: (a) => (
                <span className="inline-flex gap-1">
                  <button className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => edit(a)}><Pencil className="h-4 w-4" /></button>
                  <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></button>
                </span>) },
            ]} />
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title={editing ? `Edit ${editing}` : "Add advertisement"} />
        <form onSubmit={submit} className="space-y-3 p-5">
          <Field label="Ad ID"><input className="input" required minLength={3} disabled={!!editing} value={form.ad_id} onChange={(e) => set("ad_id")(e.target.value)} placeholder="AD_131" /></Field>
          <Field label="Campaign ID"><input className="input" required value={form.campaign_id} onChange={(e) => set("campaign_id")(e.target.value)} placeholder="CMP_11" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><Select value={form.ad_type} onChange={set("ad_type")} options={data?.ad_types || ["Image", "Video", "Carousel", "Text"]} /></Field>
            <Field label="Category"><Select value={form.ad_category} onChange={set("ad_category")} options={data?.ad_categories || []} /></Field>
          </div>
          <Field label="Has offer / discount"><Select value={form.has_offer} onChange={set("has_offer")} options={[{ value: 0, label: "No" }, { value: 1, label: "Yes" }]} /></Field>
          <Notice msg={msg} />
          <div className="flex gap-2">
            <button className="btn-primary flex-1"><Plus className="h-4 w-4" /> {editing ? "Save changes" : "Add ad"}</button>
            {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm(EMPTY_AD); }}>Cancel</button>}
          </div>
        </form>
      </Card>
    </div>
  );
}

/* ---------------- Models ---------------- */
function Models() {
  const [n, setN] = useState(0);
  const { data, loading, error } = useApi(() => api.get("/admin/model-info"), [n]);
  const [msg, run] = useAction();
  const meta = data?.meta, ev = data?.evaluation;

  const rows = meta ? Object.entries(meta.metrics).map(([t, m]) => ({
    id: t, target: t, r2: m.xgboost.r2, base: m.baseline_platform_mean.r2, mae: m.xgboost.mae, baseMae: m.baseline_platform_mean.mae,
  })) : [];
  const fmt = (t, v) => (t === "roas" ? v.toFixed(2) : (v * 100).toFixed(2) + " pp");

  return (
    <div className="space-y-6">
      {loading && <Skeleton className="h-40" />}
      <ErrorBox message={error} />
      {!loading && !meta && <ErrorBox message="Models are not trained yet." hint="Run: python ml/train.py, then press Reload models." />}
      {meta && (
        <>
          <Card>
            <CardHeader title="Model accuracy (held-out future data)" subtitle={`Trained ${new Date(meta.trained_at).toLocaleString()} · ${meta.n_train_rows.toLocaleString()} training rows · ${meta.n_test_rows.toLocaleString()} test rows`}
              action={<button className="btn-secondary" onClick={async () => { if (await run(() => api.post("/admin/reload-models"), "Models reloaded.")) setN(n + 1); }}><RefreshCw className="h-4 w-4" /> Reload models</button>} />
            <div className="p-4"><Notice msg={msg} /></div>
            <DataTable rows={rows} columns={[
              { key: "target", label: "Target", render: (r) => <span className="font-medium text-slate-900">{r.target}</span> },
              { key: "r2", label: "XGBoost R²", align: "right", render: (r) => r.r2.toFixed(3) },
              { key: "base", label: "Baseline R²", align: "right", render: (r) => r.base.toFixed(3) },
              { key: "mae", label: "XGBoost MAE", align: "right", render: (r) => fmt(r.target, r.mae) },
              { key: "baseMae", label: "Baseline MAE", align: "right", render: (r) => fmt(r.target, r.baseMae) },
            ]} />
          </Card>
          {ev?.recommendation && (
            <Card>
              <CardHeader title="Recommendation quality" subtitle="Does following the model's pick beat an average allocation?" />
              <DataTable rows={Object.entries(ev.recommendation).map(([k, v]) => ({ id: k, option: k === "ad_type" ? "Ad type" : "Platform", ...v }))} columns={[
                { key: "option", label: "Recommending" },
                { key: "top1_hit_rate", label: "Top-1 hit", align: "right", render: (r) => pct(r.top1_hit_rate, 0) },
                { key: "random_top1", label: "Random", align: "right", render: (r) => pct(r.random_top1, 0) },
                { key: "roas_following_model", label: "ROAS (model pick)", align: "right", render: (r) => r.roas_following_model.toFixed(2) },
                { key: "roas_average_allocation", label: "ROAS (average)", align: "right", render: (r) => r.roas_average_allocation.toFixed(2) },
                { key: "uplift_pct", label: "Uplift", align: "right", render: (r) => <span className="font-semibold text-emerald-600">+{r.uplift_pct.toFixed(0)}%</span> },
              ]} />
            </Card>
          )}
          <p className="text-xs text-slate-400">Trained on synthetic data - these figures show the pipeline works, not real-world accuracy.</p>
        </>
      )}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("users");
  return (
    <>
      <PageHeader title="Administration" subtitle="Manage users, advertisements and the prediction models"
        actions={<Tabs value={tab} onChange={setTab} tabs={[{ value: "users", label: "Users" }, { value: "ads", label: "Advertisements" }, { value: "models", label: "Models" }]} />} />
      {tab === "users" ? <Users /> : tab === "ads" ? <Ads /> : <Models />}
    </>
  );
}
