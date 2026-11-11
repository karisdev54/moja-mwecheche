"use client";
import Link from "next/link";
import { dismiss, useToasts, type Toast } from "@/lib/toast";
import { Icon } from "@/components/AdminUI";

const TONE: Record<Toast["tone"], { color: string; icon: string }> = {
  info: { color: "#4338ca", icon: "bell" },
  warn: { color: "#d97706", icon: "alert" },
  danger: { color: "#dc2626", icon: "alert" },
  ok: { color: "#059669", icon: "check" },
};

export default function Toaster() {
  const list = useToasts();
  if (list.length === 0) return null;

  return (
    <div className="fixed left-0 right-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex flex-col items-center gap-2 px-3 pointer-events-none">
      {list.map((t) => {
        const tone = TONE[t.tone];
        const cls =
          "pointer-events-auto relative overflow-hidden w-full max-w-sm flex items-center gap-3 rounded-2xl bg-white text-gray-900 shadow-2xl px-3 py-3 text-left";
        const style = { animation: `toast-life ${t.ms}ms ease forwards` };
        const body = (
          <>
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${tone.color} 14%, var(--surface))`, color: tone.color }}
            >
              <Icon name={tone.icon} className="w-[18px] h-[18px]" />
            </span>
            <span className="flex-1 min-w-0 text-sm font-semibold">{t.text}</span>
            {t.href && <Icon name="chevron" className="w-4 h-4 text-gray-700" />}
            <span
              className="toast-bar absolute left-0 bottom-0 h-[3px] w-full"
              style={{ background: tone.color, animationDuration: `${t.ms}ms` }}
            />
          </>
        );
        return t.href ? (
          <Link key={t.id} href={t.href} onClick={() => dismiss(t.id)} className={cls} style={style}>
            {body}
          </Link>
        ) : (
          <button key={t.id} onClick={() => dismiss(t.id)} className={cls} style={style}>
            {body}
          </button>
        );
      })}
    </div>
  );
}