"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import Badge from "@/components/Badge";
import CountUp from "@/components/motion/CountUp";
import { useInbox } from "@/lib/inbox";

type Stats = {
  bookings_total: number;
  bookings_completed: number;
  gross_collected: number;
  commission: number;
  drivers_online: number;
  customers_total: number;
  drivers_verified: number;
};
type State = { allowed: boolean; stats: Stats | null };

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;

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
  const todo: { icon: string; text: string; href: string; urgent?: boolean }[] = [];
  if (inbox) {
    if (inbox.reports_safety > 0)
      todo.push({ icon: "🚨", text: `${inbox.reports_safety} safety report(s) need you now`, href: "/admin/reports", urgent: true });
    if (inbox.drivers_pending > 0)
      todo.push({ icon: "🪪", text: `${inbox.drivers_pending} driver(s) waiting for verification`, href: "/admin/verification" });
    if (inbox.owed_drivers > 0)
      todo.push({ icon: "💸", text: `You owe ${kes(inbox.owed_total)} to ${inbox.owed_drivers} driver(s)`, href: "/admin/payouts" });
    if (inbox.refunds_count > 0)
      todo.push({ icon: "↩️", text: `${inbox.refunds_count} refund(s) to send (${kes(inbox.refunds_amount)})`, href: "/admin/refunds" });
    const plain = inbox.reports_open - inbox.reports_safety;
    if (plain > 0) todo.push({ icon: "💬", text: `${plain} open report(s)`, href: "/admin/reports" });
  }

  const tools = [
    { href: "/admin/verification", icon: "🪪", title: "Verify drivers", sub: "Check documents", n: inbox?.drivers_pending ?? 0 },
    { href: "/admin/users", icon: "👥", title: "Users", sub: "Search and suspend", n: 0 },
    { href: "/admin/bookings", icon: "🚗", title: "Bookings", sub: "Every booking", n: 0 },
    { href: "/admin/payouts", icon: "💸", title: "Payouts", sub: "Pay your drivers", n: inbox?.owed_drivers ?? 0 },
    { href: "/admin/refunds", icon: "↩️", title: "Refunds", sub: "Send money back", n: inbox?.refunds_count ?? 0 },
    { href: "/admin/reports", icon: "🚩", title: "Reports", sub: "Problems from users", n: inbox?.reports_open ?? 0 },
    { href: "/admin/stats", icon: "📊", title: "Overview", sub: "Money and trends", n: 0 },
    { href: "/admin/notifications", icon: "🔔", title: "Alerts", sub: "In and out feed", n: 0 },
  ];

  const tiles = [
    { label: "Bookings", value: s.bookings_total, money: false },
    { label: "Completed", value: s.bookings_completed, money: false },
    { label: "Collected", value: s.gross_collected, money: true },
    { label: "Your commission", value: s.commission, money: true },
    { label: "Drivers online", value: s.drivers_online, money: false },
    { label: "Verified drivers", value: s.drivers_verified, money: false },
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin</h1>
          <Link href="/dashboard" className="text-sm underline font-semibold">Back to map</Link>
        </div>

        <section className="space-y-2">
          <h2 className="font-bold">Needs your attention</h2>
          {todo.length === 0 && (
            <p className="bg-green-50 border-2 border-green-300 text-green-800 font-semibold rounded-xl p-3">
              ✅ All caught up.
            </p>
          )}
          {todo.map((t) => (
            <Link
              key={t.text}
              href={t.href}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 font-semibold ${
                t.urgent ? "border-red-500 bg-red-50 text-red-800" : "border-amber-400 bg-amber-50 text-amber-900"
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="flex-1 text-sm">{t.text}</span>
              <span>›</span>
            </Link>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="font-bold">Last 7 days</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="bg-white rounded-2xl shadow p-3">
                <p className="text-xs text-gray-700">{t.label}</p>
                <p className="text-xl font-extrabold text-indigo-800">
                  <CountUp value={Number(t.value)} prefix={t.money ? "KES " : ""} />
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-700">{s.customers_total} customers in total.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-bold">Tools</h2>
          <div className="grid grid-cols-2 gap-3">
            {tools.map((t) => (
              <Link key={t.href} href={t.href} className="lift relative bg-white rounded-2xl shadow p-4 space-y-1 active:scale-95">
                <span className="text-3xl">{t.icon}</span>
                <p className="font-bold">{t.title}</p>
                <p className="text-xs text-gray-700">{t.sub}</p>
                {t.n > 0 && (
                  <span className="absolute top-3 right-3">
                    <Badge n={t.n} />
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}