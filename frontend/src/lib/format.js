const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Indian currency, compact: 12,40,000 -> ₹12.40 L ; 33,01,20,829 -> ₹33.01 Cr */
export function money(v, compact = true) {
  if (v === null || v === undefined || Number.isNaN(v)) return "-";
  const n = Number(v);
  if (!compact) return "₹" + inr.format(n);
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return "₹" + inr.format(n);
}
export const pct = (v, d = 2) => (v === null || v === undefined ? "-" : `${(v * 100).toFixed(d)}%`);
export const roas = (v, d = 2) => (v === null || v === undefined ? "-" : `${Number(v).toFixed(d)}x`);
export const int = (v) => (v === null || v === undefined ? "-" : inr.format(Math.round(v)));
export const compactNum = (v) => {
  if (v === null || v === undefined) return "-";
  const a = Math.abs(v);
  if (a >= 1e7) return (v / 1e7).toFixed(2) + " Cr";
  if (a >= 1e5) return (v / 1e5).toFixed(2) + " L";
  if (a >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(Math.round(v));
};
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const prettyLabel = (s) => String(s).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
