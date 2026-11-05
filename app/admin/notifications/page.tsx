"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import type { Inbox } from "@/lib/inbox";
import BottomNav from "@/components/BottomNav";
import AdminNav from "@/components/AdminNav";

type Ev = {
  ts: string;
  kind: string;
  direction: "in" | "out" | "info";
  title: string;
  detail: string;
  amount: number | null;
};
type State = { inbox: Inbox | null; feed: Ev[]; at: number };

const ICON: Record<string, string> = {
  signup: "👤",
  booking: "🚗",
  payment: "💰",
  completed: "✅",
  payout: "💸",
  refund: "↩️",
  report: "🚩",
};
const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;

function ago(iso: string, now: number) {
  const s = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

async function load(): Promise<State> {
  const { data: inbox } = await supabase.rpc("admin_inbox");
  const { data: feed } = await supabase.rpc("admin_feed", { p_limit: 40 });
  return { inbox: (inbox as Inbox | null) ?? null, feed: (feed ?? []) as Ev[], at: Date.now() };
}

export default function NotificationsPage() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let active = true;
    const run = () =>
      load().then((s) => {
        if (active) setState(s);
      });
    run();
    const t = setInterval(run, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  if (!state) return <Loader full />;
  if (!state.inbox) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const i = state.inbox;
  const todo: { icon: string; text: string; href?: string; tone: string }[] = [];
  if (i.reports_safety > 0)
    todo.push({ icon: "🚨", text: `${i.reports_safety} safety report${i.reports_safety > 1 ? "s" : ""} need you now`, href: "/admin/reports", tone: "border-red-500 bg-red-50 text-red-800" });
  if (i.drivers_pending > 0)
    todo.push({ icon: "🪪", text: `${i.drivers_pending} driver${i.drivers_pending > 1 ? "s" : ""} waiting for verification`, href: "/admin", tone: "border-amber-400 bg-amber-50 text-amber-900" });
  if (i.owed_drivers > 0)
    todo.push({ icon: "💸", text: `You owe ${kes(i.owed_total)} to ${i.owed_drivers} driver${i.owed_drivers > 1 ? "s" : ""}`, href: "/admin/payouts", tone: "border-amber-400 bg-amber-50 text-amber-900" });
  if (i.refunds_count > 0)
    todo.push({ icon: "↩️", text: `${i.refunds_count} refund${i.refunds_count > 1 ? "s" : ""} to send (${kes(i.refunds_amount)})`, href: "/admin/refunds", tone: "border-amber-400 bg-amber-50 text-amber-900" });
  const plainReports = i.reports_open - i.reports_safety;
  if (plainReports > 0)
    todo.push({ icon: "💬", text: `${plainReports} open report${plainReports > 1 ? "s" : ""}`, href: "/admin/reports", tone: "border-indigo-300 bg-indigo-50 text-indigo-900" });
  if (i.stuck_payments > 0)
    todo.push({ icon: "⚠️", text: `${i.stuck_payments} payment${i.stuck_payments > 1 ? "s" : ""} pending over 15 minutes. Check the payments table.`, tone: "border-indigo-300 bg-indigo-50 text-indigo-900" });

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-2xl mx-auto space-y-4 text-gray-900">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">🔔 Notifications</h1>
          <AdminNav />
          <Link href="/profile" className="text-sm underline">Back</Link>
        </div>

        <h2 className="text-lg font-bold">Needs your attention</h2>
        {todo.length === 0 && (
          <p className="bg-green-50 border-2 border-green-300 text-green-800 font-semibold rounded-xl p-4">
            ✅ All caught up. Nothing is waiting for you.
          </p>
        )}
        {todo.map((t) => {
          const body = (
            <div className={`border-2 rounded-xl p-3 font-semibold flex items-center gap-3 ${t.tone}`}>
              <span className="text-2xl">{t.icon}</span>
              <span className="flex-1">{t.text}</span>
              {t.href && <span>›</span>}
            </div>
          );
          return t.href ? (
            <Link key={t.text} href={t.href} className="block">{body}</Link>
          ) : (
            <div key={t.text}>{body}</div>
          );
        })}

        <h2 className="text-lg font-bold pt-2">Activity: what came in and what went out</h2>
        {state.feed.length === 0 && <p>Nothing has happened yet.</p>}
        {state.feed.map((e, idx) => {
          const money = e.kind === "payment" || e.kind === "payout" || e.kind === "refund";
          return (
            <div key={`${e.ts}-${idx}`} className="bg-white rounded-xl shadow p-3 flex items-center gap-3 text-sm">
              <span className="text-2xl">{ICON[e.kind] ?? "•"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{e.title}</p>
                <p className="text-xs text-gray-700 truncate">
                  {e.detail} · {ago(e.ts, state.at)}
                </p>
              </div>
              <div className="text-right shrink-0">
                {e.direction !== "info" && (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      e.direction === "in" ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
                    }`}
                  >
                    {e.direction === "in" ? "In" : "Out"}
                  </span>
                )}
                {e.amount !== null && Number(e.amount) > 0 && (
                  <p className={`font-bold ${money ? (e.direction === "in" ? "text-green-700" : "text-red-600") : "text-gray-700"}`}>
                    {money ? (e.direction === "in" ? "+" : "−") : ""}
                    {kes(Number(e.amount))}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-xs text-gray-700 text-center">Updates every 30 seconds.</p>
      </div>
      <BottomNav />
    </main>
  );
}