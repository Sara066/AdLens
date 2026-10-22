import { BarChart3, FileText, GitCompareArrows, LayoutDashboard, LogOut, Menu, Settings, Sparkles, Target, Users, X } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { OptionsProvider } from "../context/OptionsContext.jsx";
import { Badge } from "./ui.jsx";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/predict", label: "Predict", icon: Sparkles },
  { to: "/recommend", label: "Recommend", icon: Target },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/segments", label: "Segments", icon: Users },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/admin", label: "Admin", icon: Settings, admin: true },
];

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const items = NAV.filter((n) => !n.admin || user.role === "Admin");
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm"><BarChart3 className="h-5 w-5" /></div>
        <div>
          <p className="text-base font-semibold leading-none text-slate-900">AdInsight</p>
          <p className="mt-1 text-[11px] leading-none text-slate-500">Ad performance analyzer</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
            <Icon className="h-[18px] w-[18px]" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <Badge tone="brand">{user.role}</Badge>
          </div>
          <button onClick={logout} title="Sign out" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <OptionsProvider>
      <div className="min-h-screen">
        <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 lg:block">
          <Sidebar />
        </aside>

        {open && (
          <div className="no-print fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64 shadow-xl">
              <button className="absolute right-3 top-4 z-10 rounded-lg p-1 text-slate-500" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
              <Sidebar onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}

        <div className="lg:pl-64">
          <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
            <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><Menu className="h-5 w-5" /></button>
            <span className="font-semibold text-slate-900">AdInsight</span>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </OptionsProvider>
  );
}
