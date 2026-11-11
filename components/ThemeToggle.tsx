"use client";
import { setPref, useThemePref, type Pref } from "@/lib/theme";
import { Icon } from "@/components/AdminUI";

const OPTIONS: { v: Pref; label: string; sub: string; icon: string }[] = [
  { v: "light", label: "Light", sub: "Bright and clear", icon: "sun" },
  { v: "dark", label: "Dark", sub: "Easy at night", icon: "moon" },
  { v: "system", label: "Auto", sub: "Follows your phone", icon: "device" },
];

function Mini({ dark }: { dark: boolean }) {
  const bg = dark ? "#0b1020" : "#f5f7ff";
  const card = dark ? "#141a2e" : "#ffffff";
  const line = dark ? "#2a3358" : "#c7d2fe";
  const accent = dark ? "#818cf8" : "#4338ca";
  return (
    <div className="absolute inset-0 p-2 flex flex-col gap-1.5" style={{ background: bg }}>
      <div className="h-2 w-2/5 rounded-full" style={{ background: accent }} />
      <div className="flex-1 rounded-lg p-1.5 flex flex-col gap-1" style={{ background: card }}>
        <div className="h-1.5 w-4/5 rounded-full" style={{ background: line }} />
        <div className="h-1.5 w-3/5 rounded-full" style={{ background: line }} />
        <div className="mt-auto h-2.5 w-1/2 rounded-md" style={{ background: accent }} />
      </div>
    </div>
  );
}

function Swatch({ mode }: { mode: Pref }) {
  return (
    <div className="relative h-20 rounded-xl overflow-hidden border border-indigo-100">
      {mode === "system" ? (
        <>
          <Mini dark={false} />
          <div className="absolute inset-0" style={{ clipPath: "polygon(55% 0, 100% 0, 100% 100%, 35% 100%)" }}>
            <Mini dark />
          </div>
        </>
      ) : (
        <Mini dark={mode === "dark"} />
      )}
    </div>
  );
}

export default function ThemeToggle() {
  const pref = useThemePref();
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {OPTIONS.map((o) => {
        const on = pref === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setPref(o.v)}
            aria-pressed={on}
            className={`relative rounded-2xl border-2 bg-white p-2 text-left space-y-2 transition-all active:scale-95 ${
              on ? "border-indigo-600 shadow-lg ring-4 ring-indigo-100" : "border-indigo-100"
            }`}
          >
            <Swatch mode={o.v} />
            <div className="px-0.5 pb-0.5">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <span className="text-indigo-600">
                  <Icon name={o.icon} className="w-4 h-4" />
                </span>
                {o.label}
              </p>
              <p className="text-[11px] text-gray-700 leading-tight">{o.sub}</p>
            </div>
            {on && (
              <span className="pop-check absolute -top-2 -right-2 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow">
                <Icon name="tick" className="w-3.5 h-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}