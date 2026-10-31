"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

type Result = { days: number; stats: Stats | null; error: string };

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "All time", days: 0 },
];

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;

function Card({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <p className="text-sm text-gray-700">{label}</p>
      <p className={`text-2xl font-bold ${tone ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-700 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminStatsPage() {
  const [days, setDays] = useState(30);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc("admin_stats", { p_days: days }).then(({ data, error }) => {
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

  const maxBookings = s ? Math.max(1, ...s.daily.map((d) => d.bookings)) : 1;
  const maxRevenue = s ? Math.max(1, ...s.daily.map((d) => Number(d.revenue))) : 1;

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Overview</h1>
          <Link href="/admin" className="text-sm underline">Back to admin</Link>
        </div>

        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`flex-1 rounded-lg p-3 text-sm font-semibold border-2 ${
                days === r.days ? "bg-black text-white border-transparent" : "bg-white text-gray-900 border-indigo-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading && <Loader label="Loading stats" />}

        {!loading && result?.error && (
          <p className="text-red-600">
            {result.error.includes("Not allowed")
              ? "Not authorized. Log in with the admin account."
              : `Could not load: ${result.error}`}
          </p>
        )}

        {s && (
          <>
            <h2 className="text-lg font-bold pt-2">Money</h2>
            <div className="grid grid-cols-2 gap-3">
              <Card label="Collected from customers" value={kes(s.gross_collected)} />
              <Card label="Your commission" value={kes(s.commission)} sub="From completed jobs" tone="text-green-700" />
              <Card label="Driver earnings" value={kes(s.driver_earnings)} sub="From completed jobs" />
              <Card label="Owed to drivers now" value={kes(s.owed_to_drivers)} sub="All time, after payouts" tone="text-indigo-800" />
              <Card label="Refunded" value={kes(s.refunded)} />
              <Card
                label="Refunds waiting"
                value={kes(s.refunds_pending)}
                sub={`${s.refunds_pending_count} booking${s.refunds_pending_count === 1 ? "" : "s"}`}
                tone={s.refunds_pending_count > 0 ? "text-red-600" : undefined}
              />
            </div>

            <h2 className="text-lg font-bold pt-2">Bookings</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card label="Total" value={s.bookings_total} />
              <Card label="Completed" value={s.bookings_completed} tone="text-green-700" />
              <Card label="In progress" value={s.bookings_active} />
              <Card label="Waiting for a driver" value={s.bookings_requested} />
              <Card label="Cancelled" value={s.bookings_cancelled} />
              <Card label="Expired" value={s.bookings_expired} sub="No driver accepted" />
            </div>

            <h2 className="text-lg font-bold pt-2">People</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card label="Drivers online now" value={s.drivers_online} tone="text-green-700" />
              <Card label="Verified drivers" value={s.drivers_verified} />
              <Card
                label="Awaiting verification"
                value={s.drivers_pending}
                tone={s.drivers_pending > 0 ? "text-red-600" : undefined}
              />
              <Card label="Customers" value={s.customers_total} />
              <Card
                label="Average rating"
                value={s.rating_count > 0 ? `${Number(s.avg_rating).toFixed(1)} ★` : "No ratings"}
                sub={`${s.rating_count} rating${s.rating_count === 1 ? "" : "s"}`}
              />
            </div>

            <h2 className="text-lg font-bold pt-2">Last 14 days</h2>
            <div className="bg-white rounded-2xl shadow p-4 space-y-2 text-gray-900">
              <div className="flex text-xs font-semibold text-gray-700">
                <span className="w-16">Day</span>
                <span className="flex-1">Bookings</span>
                <span className="flex-1 text-right">Revenue</span>
              </div>
              {s.daily.map((d) => (
                <div key={d.day} className="flex items-center gap-2 text-xs">
                  <span className="w-16">{d.day}</span>
                  <div className="flex-1 flex items-center gap-1">
                    <div
                      className="h-3 bg-indigo-600 rounded"
                      style={{ width: `${(d.bookings / maxBookings) * 100}%`, minWidth: d.bookings ? 4 : 0 }}
                    />
                    <span>{d.bookings}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-end gap-1">
                    <span>{Number(d.revenue) ? kes(d.revenue) : "-"}</span>
                    <div
                      className="h-3 bg-green-600 rounded"
                      style={{ width: `${(Number(d.revenue) / maxRevenue) * 40}%`, minWidth: Number(d.revenue) ? 4 : 0 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}