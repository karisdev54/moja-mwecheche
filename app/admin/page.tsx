"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import Badge from "@/components/Badge";
import { useInbox } from "@/lib/inbox";
import { Icon, Num, Tile, PageHeader } from "@/components/AdminUI";
import AdminNav from "@/components/AdminNav";

type Daily = { day: string; bookings: number; revenue: number };
type Stats = {
  bookings_total: number;
  bookings_completed: number;
  gross_collected: number;
  commission: number;
  drivers_online: number;
  drivers_verified: number;
  customers_total: number;
  daily: Daily[];
};
type State = { allowed: boolean; stats: Stats | null };

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;


/* ---------- Revenue chart that draws itself ---------- */
function AreaChart({ values, first, last }: { values: number[]; first: string; last: string }) {
  if (values.length < 2) return <p className="text-sm text-white/80">Not enough data yet.</p>;

  const W = 300;
  const H = 90;
  const P = 8;
  const max = Math.max(1, ...values);
  const n = values.length;
  const pts = values.map((v, i) => [(i / (n - 1)) * W, H - P - (v / max) * (H - P * 2)] as const);

  let d = "";
  pts.forEach(([x, y], i) => {
    if (i === 0) {
      d += `M${x},${y}`;
      return;
    }
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    d += ` C${cx},${py} ${cx},${y} ${x},${y}`;
  });
  const end = pts[pts.length - 1];
  const area = `${d} L${end[0]},${H} L0,${H} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden="true">
        <defs>
          <linearGradient id="rev-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#rev-area)" className="area-fade" />
        <path
          d={d}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="line-draw"
        />
      </svg>
      <div className="flex justify-between text-[11px] text-white/80 mt-1">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

/* ---------- Completion ring ---------- */
function Ring({ pct }: { pct: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={R} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="#10b981"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={on ? C * (1 - pct) : C}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold leading-none">{Math.round(pct * 100)}%</span>
        <span className="text-[10px] text-gray-700">completed</span>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  prefix,
  icon,
  color,
  live,
}: {
  label: string;
  value: number;
  prefix?: string;
  icon: string;
  color: string;
  live?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Tile name={icon} color={color} size="w-9 h-9" />
        {live && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
            <span className="relative flex w-2 h-2">
              <span className="live-ping absolute inline-flex w-full h-full rounded-full bg-emerald-500" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-extrabold tracking-tight">
          <Num value={value} prefix={prefix} />
        </p>
        <p className="text-xs text-gray-700">{label}</p>
      </div>
    </div>
  );
}

export default function AdminHome() {
  const [state, setState] = useState<State | null>(null);
  const inbox = useInbox();

  useEffect(() => {
    let active = true;
    supabase.rpc("admin_stats", { p_days: 7 }).then(({ data, error }) => {
      if (active) setState({ allowed: !error, stats: error ? null : (data as Stats) });
    });
    return () => {
      active = false;
    };
  }, []);

  if (!state) return <Loader full />;
  if (!state.allowed || !state.stats) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const s = state.stats;
  const daily = s.daily ?? [];
  const completion = s.bookings_total > 0 ? s.bookings_completed / s.bookings_total : 0;

  const todo: { icon: string; text: string; href: string; urgent?: boolean }[] = [];
  if (inbox) {
    if (inbox.reports_safety > 0)
      todo.push({ icon: "alert", text: `${inbox.reports_safety} safety report${inbox.reports_safety > 1 ? "s" : ""} need you now`, href: "/admin/reports", urgent: true });
    if (inbox.drivers_pending > 0)
      todo.push({ icon: "verify", text: `${inbox.drivers_pending} driver${inbox.drivers_pending > 1 ? "s" : ""} waiting for verification`, href: "/admin/verification" });
    if (inbox.owed_drivers > 0)
      todo.push({ icon: "wallet", text: `You owe ${kes(inbox.owed_total)} to ${inbox.owed_drivers} driver${inbox.owed_drivers > 1 ? "s" : ""}`, href: "/admin/payouts" });
    if (inbox.refunds_count > 0)
      todo.push({ icon: "refund", text: `${inbox.refunds_count} refund${inbox.refunds_count > 1 ? "s" : ""} to send, ${kes(inbox.refunds_amount)}`, href: "/admin/refunds" });
    const plain = inbox.reports_open - inbox.reports_safety;
    if (plain > 0)
      todo.push({ icon: "flag", text: `${plain} open report${plain > 1 ? "s" : ""}`, href: "/admin/reports" });
        if (inbox.cars_pending > 0)
      todo.push({ icon: "car", text: `${inbox.cars_pending} vehicle${inbox.cars_pending > 1 ? "s" : ""} waiting for approval`, href: "/admin/vehicles" });
  }

  const groups: {
    title: string;
    items: { href: string; icon: string; title: string; sub: string; color: string; n?: number }[];
  }[] = [
    {
      title: "Operations",
      items: [
        { href: "/admin/verification", icon: "verify", title: "Verify drivers", sub: "Review documents", color: "#6366f1", n: inbox?.drivers_pending },
        { href: "/admin/users", icon: "users", title: "Users", sub: "Search and suspend accounts", color: "#0ea5e9" },
        { href: "/admin/bookings", icon: "car", title: "Bookings", sub: "Every booking, with filters", color: "#10b981" },
        { href: "/admin/vehicles", icon: "car", title: "Vehicles", sub: "Approve logbooks and plates", color: "#0ea5e9", n: inbox?.cars_pending },
      ],
    },
    {
      title: "Money",
      items: [
        { href: "/admin/payouts", icon: "wallet", title: "Payouts", sub: "What you owe drivers", color: "#f59e0b", n: inbox?.owed_drivers },
        { href: "/admin/refunds", icon: "refund", title: "Refunds", sub: "Send money back", color: "#f43f5e", n: inbox?.refunds_count },
        { href: "/admin/stats", icon: "chart", title: "Overview", sub: "Revenue and trends", color: "#8b5cf6" },
      ],
    },
    {
      title: "Support",
      items: [
        { href: "/admin/reports", icon: "flag", title: "Reports", sub: "Problems from users", color: "#f97316", n: inbox?.reports_open },
        { href: "/admin/notifications", icon: "bell", title: "Alerts", sub: "Money in and out feed", color: "#06b6d4" },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-6 text-gray-900 stagger">
        <PageHeader title="Dashboard" subtitle="brief and overview" />
                <AdminNav />

        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Collected, last 7 days</p>
              <p className="text-4xl font-extrabold tracking-tight mt-1">
                <Num value={Number(s.gross_collected)} prefix="KES " />
              </p>
            </div>
            <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon name="trend" />
            </span>
          </div>

          <div className="flex gap-6 mt-3 text-sm">
            <div>
              <p className="text-white/80 text-xs">Your commission</p>
              <p className="font-bold">{kes(s.commission)}</p>
            </div>
            <div>
              <p className="text-white/80 text-xs">Bookings</p>
              <p className="font-bold">{s.bookings_total}</p>
            </div>
          </div>

          <div className="mt-4">
            <AreaChart
              values={daily.map((d) => Number(d.revenue))}
              first={daily[0]?.day ?? ""}
              last={daily[daily.length - 1]?.day ?? ""}
            />
            <p className="text-[11px] text-white/70 mt-1">Daily revenue, last 14 days</p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">Needs your attention</h2>
          {todo.length === 0 ? (
            <div className="slide-in flex items-center gap-3 bg-white rounded-2xl shadow p-4" style={{ borderLeft: "4px solid #10b981" }}>
              <Tile name="check" color="#10b981" />
              <div>
                <p className="font-bold">All caught up</p>
                <p className="text-xs text-gray-700">Nothing is waiting for you right now.</p>
              </div>
            </div>
          ) : (
            todo.map((t, i) => (
              <Link
                key={t.text}
                href={t.href}
                className="slide-in group flex items-center gap-3 bg-white rounded-2xl shadow p-3 active:scale-[0.98]"
                style={{ animationDelay: `${i * 70}ms`, borderLeft: `4px solid ${t.urgent ? "#dc2626" : "#f59e0b"}` }}
              >
                <Tile name={t.icon} color={t.urgent ? "#dc2626" : "#f59e0b"} />
                <p className="flex-1 text-sm font-semibold">{t.text}</p>
                {t.urgent && (
                  <span className="relative flex w-2.5 h-2.5">
                    <span className="live-ping absolute inline-flex w-full h-full rounded-full bg-red-500" />
                    <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-red-600" />
                  </span>
                )}
                <Icon name="chevron" className="w-5 h-5 text-gray-700 transition-transform group-hover:translate-x-1" />
              </Link>
            ))
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">Last 7 days</h2>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Bookings" value={s.bookings_total} icon="car" color="#6366f1" />
            <Kpi label="Completed jobs" value={s.bookings_completed} icon="check" color="#10b981" />
            <Kpi label="Commission" value={Number(s.commission)} prefix="KES " icon="wallet" color="#f59e0b" />
            <Kpi label="Drivers online" value={s.drivers_online} icon="users" color="#0ea5e9" live />
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow p-5 flex items-center gap-5">
          <Ring pct={completion} />
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-bold">Platform health</p>
              <p className="text-xs text-gray-700">Share of bookings that were completed</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xl font-extrabold"><Num value={s.drivers_verified} /></p>
                <p className="text-xs text-gray-700">Verified drivers</p>
              </div>
              <div>
                <p className="text-xl font-extrabold"><Num value={s.customers_total} /></p>
                <p className="text-xs text-gray-700">Customers</p>
              </div>
            </div>
          </div>
        </section>

        {groups.map((g) => (
          <section key={g.title} className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">{g.title}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.items.map((t, i) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="slide-in lift group flex items-center gap-3 bg-white rounded-2xl shadow p-3 active:scale-[0.98]"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <Tile name={t.icon} color={t.color} size="w-11 h-11" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold leading-tight">{t.title}</p>
                    <p className="text-xs text-gray-700 truncate">{t.sub}</p>
                  </div>
                  {t.n !== undefined && t.n > 0 && <Badge n={t.n} />}
                  <Icon name="chevron" className="w-5 h-5 text-gray-700 transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}