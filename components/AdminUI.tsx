"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";

export const ICONS: Record<string, string[]> = {
  verify: ["M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z", "M9 12l2 2 4-4"],
  shield: ["M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"],
  users: [
    "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1",
    "M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    "M21 20v-1a4 4 0 0 0-3-3.87",
    "M16 4.13a3.5 3.5 0 0 1 0 6.74",
  ],
  user: ["M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  car: [
    "M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16",
    "M3 16h18v3a1 1 0 0 1-1 1h-2v-2H6v2H4a1 1 0 0 1-1-1v-3z",
    "M7.5 13h.01",
    "M16.5 13h.01",
  ],
  key: [
    "M21 2l-2 2",
    "M11.4 11.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8z",
    "M11.4 11.6L15.5 7.5",
    "M15.5 7.5l3 3L22 7l-3-3",
    "M15.5 7.5L19 4",
  ],
  wallet: [
    "M3 7a2 2 0 0 1 2-2h12v4",
    "M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z",
    "M16 14h.01",
  ],
  refund: ["M9 14L4 9l5-5", "M4 9h10a6 6 0 0 1 0 12h-3"],
  flag: ["M5 21V4", "M5 4h11l-2 4 2 4H5"],
  chart: ["M5 21v-8", "M12 21V5", "M19 21v-12"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  alert: [
    "M12 9v4",
    "M12 17h.01",
    "M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  ],
  check: ["M22 11.1V12a10 10 0 1 1-5.9-9.1", "M22 4L12 14l-3-3"],
  chevron: ["M9 6l6 6-6 6"],
  back: ["M19 12H5", "M11 6l-6 6 6 6"],
  trend: ["M3 17l6-6 4 4 8-8", "M15 7h6v6"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
  phone: [
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
  ],
  pin: ["M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  bolt: ["M13 2L4 14h7l-1 8 9-12h-7l1-8z"],
  calendar: ["M7 3v4", "M17 3v4", "M4 9h16", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  inbox: ["M4 13l2-8h12l2 8", "M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5", "M4 13h5l1 2h4l1-2h5"],
  edit: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"],
  lock: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  sun: [
    "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
    "M12 1v2",
    "M12 21v2",
    "M4.2 4.2l1.4 1.4",
    "M18.4 18.4l1.4 1.4",
    "M1 12h2",
    "M21 12h2",
    "M4.2 19.8l1.4-1.4",
    "M18.4 5.6l1.4-1.4",
  ],
  help: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01"],
  doc: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h6"],
  trash: [
    "M3 6h18",
    "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2",
    "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
    "M10 11v6",
    "M14 11v6",
  ],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  power: ["M12 2v10", "M18.4 6.6a9 9 0 1 1-12.8 0"],
  mail: ["M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "M3 7l9 6 9-6"],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  eyeoff: [
    "M17.9 17.9A10.9 10.9 0 0 1 12 20C5 20 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9",
    "M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2",
    "M1 1l22 22",
    "M14.1 14.1a3 3 0 1 1-4.2-4.2",
  ],
  star: ["M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  locate: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v3", "M12 19v3", "M2 12h3", "M19 12h3"],
    close: ["M18 6L6 18", "M6 6l12 12"],
  plus: ["M12 5v14", "M5 12h14"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
    tick: ["M5 12l5 5L20 7"],
  idcard: [
    "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    "M7 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
    "M4.5 16c.4-1.7 1.4-2.5 2.5-2.5s2.1.8 2.5 2.5",
    "M13 9h5",
    "M13 13h5",
  ],
  camera: [
    "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z",
    "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
  image: [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    "M21 15l-5-5L5 21",
  ],
  moon: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
  device: ["M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z", "M11 18h2"],
  send: ["M22 2L11 13", "M22 2l-7 20-4-9-9-4 20-7z"],
  ban: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M5.6 5.6l12.8 12.8"],
  undo: ["M3 7v6h6", "M21 17a9 9 0 0 0-15-6.7L3 13"],
  copy: [
    "M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z",
    "M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  ],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 16v-5", "M12 8h.01"],
};

export function Icon({
  name,
  className = "w-5 h-5",
  size = 20,
}: {
  name: string;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
    >
      {(ICONS[name] ?? []).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}


// A soft coloured square holding an icon
export function Tile({ name, color, size = "w-10 h-10" }: { name: string; color: string; size?: string }) {
  return (
    <span
      className={`${size} rounded-xl flex items-center justify-center shrink-0`}
      style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))`, color }}
    >
      <Icon name={name} />
    </span>
  );
}

function useCount(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduce ? 1 : ms;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / dur);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function Num({ value, prefix = "" }: { value: number; prefix?: string }) {
  const v = useCount(value);
  return (
    <>
      {prefix}
      {Math.round(v).toLocaleString()}
    </>
  );
}


export function PageHeader({
  title,
  subtitle,
  href = "/admin",
  back,
}: {
  title: string;
  subtitle: string;
  href?: string;
  back?: string; // kept so pages that pass back="Profile" still compile; it names the button for screen readers
}) {
  const label = back ? `Back to ${back}` : "Go back";
  return (
    <header className="flex items-center gap-3">
      <Link
        href={href}
        aria-label={label}
        title={label}
        className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white border border-indigo-100 shadow-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 active:scale-95 transition-all"
      >
        <Icon name="back" className="w-5 h-5" />
      </Link>

      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight truncate">{title}</h1>
        <p className="text-sm text-gray-700">{subtitle}</p>
      </div>
    </header>
  );
}


// A person with an initial, a name, a small label and a round call button
export function PersonRow({
  role,
  name,
  phone,
  avatar,
  empty = "Not assigned yet",
  children,
}: {
  role: string;
  name: string | null | undefined;
  phone?: string | null;
  avatar?: string | null;
  empty?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-indigo-100 p-3">
      <Avatar src={avatar} name={name} size={44} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">{role}</p>
        <p className="text-sm font-semibold truncate">{name || empty}</p>
        {children}
      </div>
      {phone && (
        <a
          href={`tel:${phone}`}
          aria-label={`Call ${name ?? role}`}
          className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 active:scale-90"
        >
          <Icon name="phone" className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {text}
    </span>
  );
}

export function Stat({
  icon,
  color,
  label,
  value,
  prefix = "",
  loading = false,
}: {
  icon: string;
  color: string;
  label: string;
  value: number;
  prefix?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-3 space-y-2">
      <Tile name={icon} color={color} size="w-8 h-8" />
      <div>
        <p className="text-xl font-extrabold tracking-tight">
          {loading ? "-" : <Num value={value} prefix={prefix} />}
        </p>
        <p className="text-xs text-gray-700">{label}</p>
      </div>
    </div>
  );
}

export function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-8 text-center space-y-2">
      <div className="flex justify-center">
        <Tile name={icon} color="#6366f1" size="w-14 h-14" />
      </div>
      <p className="font-bold">{title}</p>
      <p className="text-sm text-gray-700">{text}</p>
    </div>
  );
}