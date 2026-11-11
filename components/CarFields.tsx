"use client";
import PlateBadge from "@/components/PlateBadge";
import { Icon } from "@/components/AdminUI";
import { normalizePlate } from "@/lib/validate";

export type CarState = { has: boolean | null; plate: string; details: string };
export const emptyCar: CarState = { has: null, plate: "", details: "" };

export default function CarFields({
  value,
  onChange,
  error,
}: {
  value: CarState;
  onChange: (v: CarState) => void;
  error?: string;
}) {
  const norm = normalizePlate(value.plate);
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">Do you have a car?</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: true, icon: "car", label: "Yes, I have a car" },
          { v: false, icon: "user", label: "No car" },
        ].map((o) => {
          const on = value.has === o.v;
          return (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => onChange({ ...value, has: o.v })}
              className={`rounded-2xl border-2 p-3 text-sm font-bold text-center flex flex-col items-center gap-1 transition-all active:scale-95 ${
                on
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
                  : "border-indigo-200 bg-white text-gray-900"
              }`}
            >
              <Icon name={o.icon} className="w-6 h-6" />
              {o.label}
            </button>
          );
        })}
      </div>

      {value.has === true && (
        <div className="space-y-2 slide-in">
          <input
            className="w-full border-2 border-indigo-200 rounded-xl p-3 uppercase tracking-widest focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={10}
            placeholder="Number plate, e.g. KDA 123A"
            value={value.plate}
            onChange={(e) => onChange({ ...value, plate: e.target.value })}
          />
          {norm && <PlateBadge plate={norm} />}
          <input
            className="w-full border-2 border-indigo-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            maxLength={80}
            autoComplete="off"
            placeholder="Make, model and colour (optional)"
            value={value.details}
            onChange={(e) => onChange({ ...value, details: e.target.value })}
          />
        </div>
      )}
      {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}
    </div>
  );
}