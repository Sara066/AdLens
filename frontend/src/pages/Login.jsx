import { BarChart3, Lightbulb, LineChart, Target } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { ErrorBox, Field } from "../components/ui.jsx";

const DEMO = [
  { label: "Manager", email: "manager@adinsight.com", password: "manager123" },
  { label: "Analyst", email: "analyst@adinsight.com", password: "analyst123" },
  { label: "Admin", email: "admin@adinsight.com", password: "admin123" },
];

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Manager" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><BarChart3 className="h-5 w-5" /></div>
          <span className="text-xl font-semibold">AdInsight</span>
        </div>
        <div>
          <h2 className="max-w-md text-4xl font-semibold leading-tight !text-white">Every ad rupee where it performs best.</h2>
          <p className="mt-4 max-w-md text-brand-100">
            Predict CTR, conversions and ROAS before you spend, and get the best ad and platform for each customer segment.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-brand-50">
            {[[LineChart, "One dashboard across Instagram, Facebook, YouTube and Google"],
              [Lightbulb, "AI performance prediction before committing budget"],
              [Target, "Ad and platform recommendations per audience"]].map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-3"><span className="rounded-lg bg-white/10 p-2"><Icon className="h-4 w-4" /></span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200">Design Thinking and PLM project - CSE (AI)</p>
      </div>

      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "Sign in to your dashboard." : "Register as a Manager or Analyst."}</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "register" && (
              <Field label="Full name"><input className="input" required minLength={2} value={form.name} onChange={set("name")} placeholder="Priya Kulkarni" /></Field>
            )}
            <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set("email")} placeholder="you@company.com" /></Field>
            <Field label="Password"><input className="input" type="password" required minLength={mode === "register" ? 6 : 1} value={form.password} onChange={set("password")} placeholder="••••••••" /></Field>
            {mode === "register" && (
              <Field label="Role">
                <select className="input" value={form.role} onChange={set("role")}><option>Manager</option><option>Analyst</option></select>
              </Field>
            )}
            <ErrorBox message={error} />
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            {mode === "login" ? "New here? " : "Already registered? "}
            <button className="font-medium text-brand-600 hover:underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          {mode === "login" && (
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Demo accounts</p>
              <div className="mt-3 flex gap-2">
                {DEMO.map((d) => (
                  <button key={d.label} type="button" className="btn-secondary flex-1 !px-2 !py-1.5 text-xs"
                    onClick={() => setForm({ ...form, email: d.email, password: d.password })}>{d.label}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">Click one to fill the form, then press Sign in.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
