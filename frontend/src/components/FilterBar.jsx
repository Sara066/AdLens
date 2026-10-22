import { RotateCcw } from "lucide-react";
import { useOptions } from "../context/OptionsContext.jsx";
import { Select } from "./ui.jsx";

export const EMPTY_FILTERS = {
  platform: "", ad_type: "", age_group: "", gender: "", interest: "", campaign_id: "", date_from: "", date_to: "",
};

const FIELDS = {
  platform: { label: "All platforms", opt: "platforms" },
  ad_type: { label: "All ad types", opt: "ad_types" },
  age_group: { label: "All ages", opt: "age_groups" },
  gender: { label: "All genders", opt: "genders" },
  interest: { label: "All interests", opt: "interests" },
  campaign_id: { label: "All campaigns", opt: "campaigns" },
};

/** show: which filters to display, e.g. ["platform","age_group"]. dates: show the date range. */
export default function FilterBar({ filters, onChange, show = ["platform", "ad_type", "age_group", "gender"], dates = true }) {
  const { options } = useOptions();
  const set = (k) => (v) => onChange({ ...filters, [k]: v });
  const dirty = Object.values(filters).some(Boolean);

  return (
    <div className="no-print mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-card">
      {show.map((k) => (
        <div key={k} className="w-40">
          <Select value={filters[k]} onChange={set(k)} placeholder={FIELDS[k].label} options={options?.[FIELDS[k].opt] || []} />
        </div>
      ))}
      {dates && (
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <input type="date" className="input w-36" value={filters.date_from} onChange={(e) => set("date_from")(e.target.value)} />
          <span>to</span>
          <input type="date" className="input w-36" value={filters.date_to} onChange={(e) => set("date_to")(e.target.value)} />
        </div>
      )}
      {dirty && (
        <button className="btn-secondary ml-auto" onClick={() => onChange(EMPTY_FILTERS)}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      )}
    </div>
  );
}
