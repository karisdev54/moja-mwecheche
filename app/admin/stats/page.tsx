
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";
import { PageHeader } from "@/components/AdminUI";

type Stats = {
  bookings_total: number;
  bookings_requested: number;
  bookings_active: number;
  bookings_completed: number;
  bookings_cancelled: number;
  bookings_expired: number;
  gross_collected: number;
  refunded: number;
  refunds_pending: number;
  refunds_pending_count: number;
  commission: number;
  driver_earnings: number;
  owed_to_drivers: number;
  drivers_online: number;
  drivers_verified: number;
  drivers_pending: number;
  customers_total: number;
  avg_rating: number;
  rating_count: number;
  daily: { day: string; bookings: number; revenue: number }[];
};

type Result = {
  days: number;
  stats: Stats | null;
  error: string;
};

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "All time", days: 0 },
];

const kes = (n: number) =>
  `KES ${Math.round(Number(n) || 0).toLocaleString()}`;

/* ---------- Animated count-up numbers ---------- */

function useCount(target: number, ms = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const duration = reducedMotion ? 1 : ms;

    const animate = (time: number) => {
      if (start === null) start = time;

      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(target * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [target, ms]);

  return value;
}

function Num({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const animated = useCount(Number(value) || 0);

  return (
    <>
      {prefix}
      {Math.round(animated).toLocaleString()}
      {suffix}
    </>
  );
}

/* ---------- Reusable statistic card ---------- */

function Card({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="lift bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
      <p className="text-xs font-semibold text-gray-500">{label}</p>

      <p
        className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
          tone ?? "text-gray-900"
        }`}
      >
        {value}
      </p>

      {sub && (
        <p className="text-[11px] text-gray-500 leading-relaxed">
          {sub}
        </p>
      )}
    </div>
  );
}

/* ---------- KPI card with animated number ---------- */

function Kpi({
  label,
  value,
  prefix,
  sub,
  tone,
  live,
}: {
  label: string;
  value: number;
  prefix?: string;
  sub?: string;
  tone?: string;
  live?: boolean;
}) {
  return (
    <div className="lift bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500">
          {label}
        </span>

        {live && (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
            <span className="relative flex w-2 h-2">
              <span className="live-ping absolute w-full h-full rounded-full bg-emerald-500" />
              <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        )}
      </div>

      <p
        className={`text-2xl font-extrabold tracking-tight ${
          tone ?? "text-gray-900"
        }`}
      >
        <Num value={value} prefix={prefix} />
      </p>

      {sub && (
        <p className="text-[11px] text-gray-500">{sub}</p>
      )}
    </div>
  );
}

/* ---------- Animated revenue area chart ---------- */

function AreaChart({
  values,
  first,
  last,
}: {
  values: number[];
  first: string;
  last: string;
}) {
  if (values.length < 2) {
    return (
      <div className="rounded-xl bg-white/10 p-4">
        <p className="text-sm text-white/80">
          Not enough revenue data to display a trend yet.
        </p>
      </div>
    );
  }

  const width = 320;
  const height = 105;
  const padding = 8;

  const max = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y =
      height -
      padding -
      (Number(value) / max) * (height - padding * 2);

    return [x, y] as const;
  });

  let path = "";

  points.forEach(([x, y], index) => {
    if (index === 0) {
      path += `M${x},${y}`;
    } else {
      const [previousX, previousY] = points[index - 1];
      const controlX = (previousX + x) / 2;

      path += ` C${controlX},${previousY} ${controlX},${y} ${x},${y}`;
    }
  });

  const end = points[points.length - 1];
  const areaPath = `${path} L${end[0]},${height} L0,${height} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Revenue trend chart"
      >
        <defs>
          <linearGradient
            id="overview-revenue-fill"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#ffffff"
              stopOpacity="0.35"
            />
            <stop
              offset="100%"
              stopColor="#ffffff"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        <path
          d={areaPath}
          fill="url(#overview-revenue-fill)"
          className="area-fade"
        />

        <path
          d={path}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="line-draw"
        />

        {points.map(([x, y], index) => (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="2.5"
            fill="white"
            className="chart-point"
          />
        ))}
      </svg>

      <div className="flex justify-between text-[10px] text-white/75 mt-1">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

/* ---------- Booking completion ring ---------- */

function Ring({ pct }: { pct: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const [animate, setAnimate] = useState(false);

  const safePct = Math.min(1, Math.max(0, pct));

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg
        viewBox="0 0 80 80"
        className="w-24 h-24 -rotate-90"
        aria-label={`${Math.round(safePct * 100)} percent of bookings completed`}
        role="img"
      >
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />

        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={
            animate
              ? circumference * (1 - safePct)
              : circumference
          }
          style={{
            transition:
              "stroke-dashoffset 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold leading-none text-gray-900">
          {Math.round(safePct * 100)}%
        </span>
        <span className="text-[10px] text-gray-500 mt-1">
          completed
        </span>
      </div>
    </div>
  );
}

/* ---------- Daily performance chart ---------- */

function DailyChart({
  daily,
}: {
  daily: Stats["daily"];
}) {
  if (!daily.length) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-sm text-gray-500">
          No daily performance data available.
        </p>
      </div>
    );
  }

  const maxBookings = Math.max(
    1,
    ...daily.map((day) => Number(day.bookings))
  );

  const maxRevenue = Math.max(
    1,
    ...daily.map((day) => Number(day.revenue))
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">
            Daily performance
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Booking volume and revenue by day
          </p>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-semibold text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-indigo-600" />
            Bookings
          </span>

          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-emerald-500" />
            Revenue
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {daily.map((day, index) => {
          const bookingWidth =
            (Number(day.bookings) / maxBookings) * 100;

          const revenueWidth =
            (Number(day.revenue) / maxRevenue) * 100;

          return (
            <div
              key={day.day}
              className="daily-row space-y-1.5"
              style={{
                animationDelay: `${Math.min(index, 14) * 35}ms`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-gray-600 w-16 shrink-0">
                  {day.day}
                </span>

                <span className="text-[10px] text-gray-500">
                  {Number(day.bookings)} bookings
                </span>

                <span className="text-[10px] font-semibold text-gray-700 text-right">
                  {kes(Number(day.revenue))}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 bar-grow"
                    style={{
                      width: `${bookingWidth}%`,
                      animationDelay: `${index * 35}ms`,
                    }}
                  />
                </div>

                <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 bar-grow"
                    style={{
                      width: `${revenueWidth}%`,
                      animationDelay: `${index * 35 + 80}ms`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Main overview page ---------- */

export default function AdminStatsPage() {
  const [days, setDays] = useState(30);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let active = true;

    supabase
      .rpc("admin_stats", { p_days: days })
      .then(({ data, error }) => {
        if (!active) return;

        setResult({
          days,
          stats: error ? null : (data as Stats),
          error: error ? error.message : "",
        });
      });

    return () => {
      active = false;
    };
  }, [days]);

  const loading = !result || result.days !== days;
  const s = result?.days === days ? result.stats : null;

  const daily = s?.daily ?? [];

  const completion =
    s && s.bookings_total > 0
      ? s.bookings_completed / s.bookings_total
      : 0;

  const periodLabel =
    days === 0
      ? "All time"
      : `Last ${days} days`;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900 stagger">

        {/* HEADER */}
         <PageHeader title="Overview" subtitle="Revenue, bookings and platform performance" />
        {/* ADMIN MENU */}
        
          <AdminNav />
      

        {/* DATE RANGE FILTER */}
        <section
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 slide-in"
          aria-label="Statistics date range"
        >
          <div className="grid grid-cols-3 gap-2">
            {RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setDays(range.days)}
                aria-pressed={days === range.days}
                className={`rounded-xl px-2 py-3 text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 ${
                  days === range.days
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </section>

        {/* LOADING */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <Loader label="Loading statistics" />
          </div>
        )}

        {/* ERROR */}
        {!loading && result?.error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 slide-in">
            <p className="font-bold text-red-800">
              Unable to load statistics
            </p>

            <p className="text-sm text-red-700 mt-1">
              {result.error.includes("Not allowed")
                ? "Not authorized. Log in with the admin account."
                : result.error}
            </p>

            <Link
              href="/login"
              className="inline-block text-sm font-bold text-red-800 underline mt-2"
            >
              Log in as administrator
            </Link>
          </div>
        )}

        {/* DASHBOARD DATA */}
        {!loading && s && (
          <>
            {/* REVENUE HERO */}
            <section
              className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg slide-in sheen"
              style={{
                background:
                  "linear-gradient(135deg, #312e81 0%, #4338ca 52%, #0e7490 100%)",
              }}
            >
              <div className="relative z-10 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white/75">
                    Total collected · {periodLabel}
                  </p>

                  <p className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2">
                    <Num
                      value={Number(s.gross_collected)}
                      prefix="KES "
                    />
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
                  <div>
                    <p className="text-[11px] text-white/70">
                      Your commission
                    </p>
                    <p className="text-lg font-extrabold mt-1">
                      <Num
                        value={Number(s.commission)}
                        prefix="KES "
                      />
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] text-white/70">
                      Total bookings
                    </p>
                    <p className="text-lg font-extrabold mt-1">
                      <Num value={s.bookings_total} />
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/20 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-white/80">
                      Revenue trend
                    </p>
                    <p className="text-[10px] text-white/60">
                      Daily revenue
                    </p>
                  </div>

                  <AreaChart
                    values={daily.map((day) => Number(day.revenue))}
                    first={daily[0]?.day ?? ""}
                    last={daily[daily.length - 1]?.day ?? ""}
                  />
                </div>
              </div>
            </section>

            {/* MONEY */}
            <section className="space-y-3 slide-in">
              <div>
                <h2 className="text-lg font-extrabold">
                  Financial summary
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Money collected, earned and outstanding
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card
                  label="Collected from customers"
                  value={kes(s.gross_collected)}
                />

                <Card
                  label="Your commission"
                  value={kes(s.commission)}
                  sub="From completed jobs"
                  tone="text-green-700"
                />

                <Card
                  label="Driver earnings"
                  value={kes(s.driver_earnings)}
                  sub="From completed jobs"
                />

                <Card
                  label="Owed to drivers"
                  value={kes(s.owed_to_drivers)}
                  sub="Outstanding after payouts"
                  tone="text-indigo-700"
                />

                <Card
                  label="Total refunded"
                  value={kes(s.refunded)}
                />

                <Card
                  label="Refunds waiting"
                  value={kes(s.refunds_pending)}
                  sub={`${s.refunds_pending_count} booking${
                    s.refunds_pending_count === 1 ? "" : "s"
                  }`}
                  tone={
                    s.refunds_pending_count > 0
                      ? "text-red-600"
                      : undefined
                  }
                />
              </div>
            </section>

            {/* BOOKINGS */}
            <section className="space-y-3 slide-in">
              <div>
                <h2 className="text-lg font-extrabold">
                  Booking performance
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Booking status breakdown for {periodLabel.toLowerCase()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Kpi
                  label="Total bookings"
                  value={s.bookings_total}
                />

                <Kpi
                  label="Completed"
                  value={s.bookings_completed}
                  tone="text-green-700"
                />

                <Kpi
                  label="In progress"
                  value={s.bookings_active}
                  tone="text-indigo-700"
                />

                <Kpi
                  label="Waiting for a driver"
                  value={s.bookings_requested}
                  tone="text-amber-700"
                />

                <Kpi
                  label="Cancelled"
                  value={s.bookings_cancelled}
                  tone="text-red-600"
                />

                <Kpi
                  label="Expired"
                  value={s.bookings_expired}
                  sub="No driver accepted"
                />
              </div>
            </section>

            {/* PEOPLE */}
            <section className="space-y-3 slide-in">
              <div>
                <h2 className="text-lg font-extrabold">
                  People and drivers
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Current platform user and driver figures
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Kpi
                  label="Drivers online now"
                  value={s.drivers_online}
                  tone="text-green-700"
                  live
                />

                <Kpi
                  label="Verified drivers"
                  value={s.drivers_verified}
                  tone="text-indigo-700"
                />

                <Kpi
                  label="Awaiting verification"
                  value={s.drivers_pending}
                  tone={
                    s.drivers_pending > 0
                      ? "text-red-600"
                      : "text-gray-900"
                  }
                />

                <Kpi
                  label="Total customers"
                  value={s.customers_total}
                />
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold">
                    Customer ratings
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {s.rating_count} rating
                    {s.rating_count === 1 ? "" : "s"} received
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-extrabold text-amber-600">
                    {s.rating_count > 0
                      ? Number(s.avg_rating).toFixed(1)
                      : "—"}
                  </p>

                  <p className="text-[10px] text-gray-500">
                    Average rating
                  </p>
                </div>
              </div>
            </section>

            {/* PLATFORM HEALTH */}
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex items-center gap-5 slide-in">
              <Ring pct={completion} />

              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <h2 className="font-extrabold text-gray-900">
                    Platform health
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    Share of bookings successfully completed
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xl font-extrabold">
                      <Num value={s.bookings_completed} />
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Completed jobs
                    </p>
                  </div>

                  <div>
                    <p className="text-xl font-extrabold">
                      <Num value={s.bookings_total} />
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Total bookings
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* DAILY CHART */}
            <section className="space-y-3 slide-in">
              <div>
                <h2 className="text-lg font-extrabold">
                  Daily activity
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Compare booking volume with revenue
                </p>
              </div>

              <DailyChart daily={daily} />
            </section>

            {/* FOOTER */}
            <div className="text-center py-3">
              <p className="text-[11px] text-gray-400">
                Key and Go · Administrator Overview
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Showing {periodLabel.toLowerCase()} statistics
              </p>
            </div>
          </>
        )}
      </div>

      {/* PAGE ANIMATIONS */}
      <style jsx global>{`
        .stagger > * {
          animation: page-enter 0.45s ease both;
        }

        .slide-in {
          animation: page-enter 0.5s ease both;
        }

        .lift {
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .lift:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
        }

        .line-draw {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: draw-line 1.5s ease forwards;
        }

        .area-fade {
          opacity: 0;
          animation: fade-area 1s ease 0.4s forwards;
        }

        .chart-point {
          opacity: 0;
          animation: point-appear 0.3s ease forwards;
        }

        .chart-point:nth-of-type(2) {
          animation-delay: 0.15s;
        }

        .bar-grow {
          transform-origin: left;
          animation: grow-bar 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .daily-row {
          animation: page-enter 0.45s ease both;
        }

        .live-ping {
          animation: live-pulse 1.6s ease-out infinite;
        }

        .sheen::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -80%;
          width: 45%;
          height: 200%;
          transform: rotate(20deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.09),
            transparent
          );
          animation: sheen-move 7s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes page-enter {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes draw-line {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes fade-area {
          to {
            opacity: 1;
          }
        }

        @keyframes point-appear {
          to {
            opacity: 1;
          }
        }

        @keyframes grow-bar {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }

        @keyframes live-pulse {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }

        @keyframes sheen-move {
          0%,
          65% {
            left: -80%;
          }
          100% {
            left: 140%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .stagger > *,
          .slide-in,
          .daily-row,
          .line-draw,
          .area-fade,
          .chart-point,
          .bar-grow,
          .live-ping,
          .sheen::after {
            animation: none !important;
            transition: none !important;
          }

          .line-draw {
            stroke-dashoffset: 0;
          }

          .area-fade,
          .chart-point {
            opacity: 1;
          }

          .bar-grow {
            transform: none;
          }
        }
      `}</style>
    </main>
  );
}
