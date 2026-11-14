"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import { Empty, Icon, Pill, Stat, Tile } from "@/components/AdminUI";
import { inboxTotal, useInbox } from "@/lib/inbox";

type Ev = {
  ts: string;
  kind: string;
  direction: "in" | "out" | "info";
  title: string;
  detail: string;
  amount: number | null;
};
type Feed = { allowed: boolean; items: Ev[]; at: number; limit: number };

const STEP = 40;
const MAX = 120;

const KIND: Record<string, { icon: string; color: string; group: string }> = {
  signup: { icon: "user", color: "#0ea5e9", group: "People" },
  booking: { icon: "car", color: "#6366f1", group: "Jobs" },
  completed: { icon: "check", color: "#059669", group: "Jobs" },
  payment: { icon: "wallet", color: "#059669", group: "Money" },
  payout: { icon: "send", color: "#d97706", group: "Money" },
  refund: { icon: "refund", color: "#f43f5e", group: "Money" },
  report: { icon: "flag", color: "#f97316", group: "Reports" },
};

const FILTERS = ["All", "Money", "People", "Jobs", "Reports"] as const;
type Filter = (typeof FILTERS)[number];

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function ago(iso: string, now: number) {
  const s = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ActivityPage() {
  const inbox = useInbox();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [limit, setLimit] = useState(STEP);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const { data: u } = await supabase.auth.getUser();
      let allowed = false;
      if (u.user) {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
        allowed = p?.role === "admin";
      }
      if (!allowed) {
        if (active) setFeed({ allowed: false, items: [], at: Date.now(), limit });
        return;
      }
      const { data } = await supabase.rpc("admin_feed", { p_limit: limit });
      if (active) setFeed({ allowed: true, items: (data ?? []) as Ev[], at: Date.now(), limit });
    };
    run();
    const t = setInterval(run, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [limit]);

  if (!feed) return <Loader full />;
  if (!feed.allowed) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const todo: { icon: string; text: string; href: string; urgent?: boolean }[] = [];
  if (inbox) {
    if (inbox.reports_safety > 0)
      todo.push({ icon: "alert", text: `${plural(inbox.reports_safety, "safety report")} need you now`, href: "/admin/reports", urgent: true });
    if (inbox.drivers_pending > 0)
      todo.push({ icon: "verify", text: `${plural(inbox.drivers_pending, "driver")} waiting for verification`, href: "/admin/verification" });
    if (inbox.cars_pending > 0)
      todo.push({ icon: "car", text: `${plural(inbox.cars_pending, "vehicle")} waiting for approval`, href: "/admin/vehicles" });
    if (inbox.owed_drivers > 0)
      todo.push({ icon: "wallet", text: `You owe ${kes(inbox.owed_total)} to ${plural(inbox.owed_drivers, "driver")}`, href: "/admin/payouts" });
    if (inbox.refunds_count > 0)
      todo.push({ icon: "refund", text: `${plural(inbox.refunds_count, "refund")} to send, ${kes(inbox.refunds_amount)}`, href: "/admin/refunds" });
    const plain = inbox.reports_open - inbox.reports_safety;
    if (plain > 0) todo.push({ icon: "flag", text: plural(plain, "open report"), href: "/admin/reports" });
    if (inbox.stuck_payments > 0)
      todo.push({ icon: "alert", text: `${plural(inbox.stuck_payments, "payment")} pending for over 15 minutes`, href: "/admin/bookings" });
  }

  const loadingMore = feed.limit !== limit;
  const shown = filter === "All" ? feed.items : feed.items.filter((e) => KIND[e.kind]?.group === filter);
  const moneyIn = feed.items.filter((e) => e.kind === "payment").reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const moneyOut = feed.items
    .filter((e) => e.kind === "payout" || e.kind === "refund")
    .reduce((s, e) => s + Number(e.amount ?? 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight">Activity</h1>
          <p className="text-sm text-gray-700">What needs you, and what came in and went out</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Needs your attention</h2>
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
                style={{ animationDelay: `${i * 60}ms`, borderLeft: `4px solid ${t.urgent ? "#dc2626" : "#f59e0b"}` }}
              >
                <Tile name={t.icon} color={t.urgent ? "#dc2626" : "#f59e0b"} />
                <p className="flex-1 text-sm font-semibold">{t.text}</p>
                <Icon name="chevron" className="w-5 h-5 text-gray-700 transition-transform group-hover:translate-x-1" />
              </Link>
            ))
          )}
          {inbox && todo.length > 0 && (
            <p className="text-xs text-gray-700">{inboxTotal(inbox)} item{inboxTotal(inbox) === 1 ? "" : "s"} in total.</p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Stat icon="wallet" color="#059669" label="Payments in, listed below" value={moneyIn} prefix="KES " />
          <Stat icon="send" color="#d97706" label="Paid out, listed below" value={moneyOut} prefix="KES " />
        </div>

        <section className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold border-2 ${
                  filter === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {shown.length === 0 && <Empty icon="inbox" title="Nothing here yet" text="New activity will appear here as it happens." />}

          {shown.map((e, i) => {
            const k = KIND[e.kind] ?? { icon: "bell", color: "#6366f1", group: "" };
            const money = k.group === "Money";
            return (
              <article
                key={`${e.ts}-${i}`}
                className="slide-in bg-white rounded-2xl shadow p-3 flex items-center gap-3"
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
              >
                <Tile name={k.icon} color={k.color} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{e.title}</p>
                  <p className="text-xs text-gray-700 truncate">
                    {e.detail}, {ago(e.ts, feed.at)}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  {e.direction !== "info" && (
                    <Pill text={e.direction === "in" ? "In" : "Out"} color={e.direction === "in" ? "#059669" : "#dc2626"} />
                  )}
                  {e.amount !== null && Number(e.amount) > 0 && (
                    <p
                      className="text-sm font-extrabold"
                      style={{ color: money ? (e.direction === "in" ? "#059669" : "#dc2626") : undefined }}
                    >
                      {money ? (e.direction === "in" ? "+" : "-") : ""}
                      {kes(Number(e.amount))}
                    </p>
                  )}
                </div>
              </article>
            );
          })}

          {feed.items.length >= limit && limit < MAX && (
            <button
              onClick={() => setLimit((l) => Math.min(MAX, l + STEP))}
              disabled={loadingMore}
              className="w-full bg-white border-2 border-indigo-300 font-bold rounded-xl p-3 disabled:opacity-60 active:scale-[0.98]"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
          <p className="text-xs text-gray-700 text-center">Updates every 30 seconds.</p>
        </section>
      </div>
    </main>
  );
}