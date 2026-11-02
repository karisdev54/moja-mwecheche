"use client";
import PlateBadge from "@/components/PlateBadge";
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
      <p className="text-sm font-semibold">Do you have a car?</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: true, icon: "🚗", label: "Yes, I have a car" },
          { v: false, icon: "🚶", label: "No car" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange({ ...value, has: o.v })}
            className={`rounded-xl border-2 p-3 text-sm font-semibold text-center ${
              value.has === o.v
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-indigo-200 bg-white text-gray-900"
            }`}
          >
            <span className="block text-2xl">{o.icon}</span>
            {o.label}
          </button>
        ))}
      </div>

      {value.has === true && (
        <div className="space-y-2">
          <input
            className="w-full border-2 border-indigo-200 rounded-xl p-3 uppercase tracking-widest"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={10}
            placeholder="Number plate, e.g. KDA 123A"
            value={value.plate}
            onChange={(e) => onChange({ ...value, plate: e.target.value })}
          />
          {norm && <PlateBadge plate={norm} />}
          <input
            className="w-full border-2 border-indigo-200 rounded-xl p-3"
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