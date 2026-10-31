"use client";
import { setPref, useThemePref, type Pref } from "@/lib/theme";

const OPTIONS: { v: Pref; label: string; icon: string }[] = [
  { v: "light", label: "Light", icon: "☀️" },
  { v: "dark", label: "Dark", icon: "🌙" },
  { v: "system", label: "Auto", icon: "📱" },
];

export default function ThemeToggle() {
  const pref = useThemePref();
  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3">
      <h2 className="font-bold">Appearance</h2>
      <div className="flex gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.v}
            onClick={() => setPref(o.v)}
            className={`flex-1 rounded-lg p-3 text-sm font-semibold border-2 ${
              pref === o.v
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-900 border-indigo-200"
            }`}
          >
            <span className="block text-lg">{o.icon}</span>
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-700">Auto follows your phone setting.</p>
    </div>
  );
}