"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";
import { Skeleton } from "@/components/Loader";
import { Icon, Num, PageHeader, Tile } from "@/components/AdminUI";

type B = {
  id: string;
  created_at: string;
  scheduled_at: string;
  timing: string;
  status: string;
  paid: boolean;
  task_type: string;
  price: number;
  destination: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  refund_status: string;
};
type Res = { key: string; rows: B[]; error: string };

const STEP = 60;
const MAX = 200;

const STATUSES = [
  { v: "", label: "All" },
  { v: "requested", label: "Requested" },
  { v: "accepted", label: "Accepted" },
  { v: "in_progress", label: "In progress" },
  { v: "completed", label: "Completed" },
  { v: "cancelled", label: "Cancelled" },
  { v: "expired", label: "Expired" },
];

const STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: "Awaiting driver", color: "#d97706" },
  accepted: { label: "Accepted", color: "#2563eb" },
  in_progress: { label: "In progress", color: "#7c3aed" },
  completed: { label: "Completed", color: "#059669" },
  cancelled: { label: "Cancelled", color: "#6b7280" },
  expired: { label: "Expired", color: "#dc2626" },
};

const money = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function Pill({ text, color }: { text: string; color: string }) {
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

function Person({
  role,
  name,
  phone,
  icon,
  empty,
}: {
  role: string;
  name: string | null;
  phone: string | null;
  icon: string;
  empty: string;
}) {
  const initial = (name ?? "").trim().charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-indigo-100 p-3">
      <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 text-sm font-bold">
        {initial || <Icon name={icon} className="w-4 h-4" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">{role}</p>
        <p className="text-sm font-semibold truncate">{name || empty}</p>
        {phone && <p className="text-xs text-gray-700 truncate">{phone}</p>}
      </div>
      {phone && (
        <a
          href={`tel:${phone}`}
          aria-label={`Call ${name ?? role}`}
          className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 active:scale-90"
        >
          <Icon name="phone" className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-6 w-24 !rounded-full" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

export default function AdminBookingsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(STEP);
  const [res, setRes] = useState<Res | null>(null);

  // Only admins may open this page
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return active && setAllowed(false);
      const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      if (active) setAllowed(p?.role === "admin");
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setApplied(q.trim());
      setLimit(STEP);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const key = `${status}|${applied}|${limit}`;

  useEffect(() => {
    if (allowed !== true) return;
    let active = true;
    supabase
      .rpc("admin_bookings", { p_status: status, p_search: applied, p_limit: limit })
      .then(({ data, error }) => {
        if (active) setRes({ key, rows: (data ?? []) as B[], error: error?.message ?? "" });
      });
    return () => {
      active = false;
    };
  }, [allowed, key, status, applied, limit]);

  if (allowed === false) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const loading = allowed === null || !res || res.key !== key;
  const rows = res && res.key === key ? res.rows : [];

  const awaiting = rows.filter((b) => b.status === "requested").length;
  const done = rows.filter((b) => b.status === "completed").length;
  const collected = rows.filter((b) => b.paid).reduce((s, b) => s + Number(b.price), 0);
  const canMore = !loading && rows.length >= limit && limit < MAX;

  const tiles = [
    { label: "Showing", value: rows.length, icon: "car", color: "#6366f1", prefix: "" },
    { label: "Awaiting driver", value: awaiting, icon: "clock", color: "#d97706", prefix: "" },
    { label: "Completed", value: done, icon: "check", color: "#059669", prefix: "" },
    { label: "Paid value", value: collected, icon: "wallet", color: "#8b5cf6", prefix: "KES " },
  ];

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <PageHeader title="Bookings" subtitle="Every booking on the platform" />
        <AdminNav />

        <section className="space-y-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="bg-white rounded-2xl shadow p-3 space-y-2">
                <Tile name={t.icon} color={t.color} size="w-8 h-8" />
                <div>
                  <p className="text-xl font-extrabold tracking-tight">
                    {loading ? "-" : <Num value={t.value} prefix={t.prefix} />}
                  </p>
                  <p className="text-xs text-gray-700">{t.label}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-700">Totals cover the bookings listed below.</p>
        </section>

        <section className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700">
              <Icon name="search" className="w-5 h-5" />
            </span>
            <input
              className="w-full border-2 border-indigo-200 rounded-xl p-3 pl-11"
              placeholder="Search customer, driver, phone or destination"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUSES.map((s) => {
              const on = status === s.v;
              const c = STATUS[s.v]?.color;
              return (
                <button
                  key={s.v}
                  onClick={() => {
                    setStatus(s.v);
                    setLimit(STEP);
                  }}
                  className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold border-2 ${
                    on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
                  }`}
                >
                  {c && <span className="w-2 h-2 rounded-full" style={{ background: on ? "#fff" : c }} />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">Booking records</h2>
            <span className="text-xs text-gray-700">{loading ? "Loading" : `${rows.length} shown`}</span>
          </div>

          {loading && (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          )}

          {!loading && res?.error && (
            <div className="bg-white rounded-2xl shadow p-4 flex gap-3 items-start" style={{ borderLeft: "4px solid #dc2626" }}>
              <Tile name="alert" color="#dc2626" />
              <div>
                <p className="font-bold">Could not load bookings</p>
                <p className="text-sm text-gray-700">{res.error}</p>
              </div>
            </div>
          )}

          {!loading && !res?.error && rows.length === 0 && (
            <div className="bg-white rounded-2xl shadow p-8 text-center space-y-2">
              <div className="flex justify-center">
                <Tile name="inbox" color="#6366f1" size="w-14 h-14" />
              </div>
              <p className="font-bold">No bookings found</p>
              <p className="text-sm text-gray-700">Try a different search, or choose another status.</p>
            </div>
          )}

          {!loading &&
            rows.map((b, i) => {
              const st = STATUS[b.status] ?? { label: b.status, color: "#6b7280" };
              const live = b.status === "accepted" || b.status === "in_progress";
              const pay = b.paid
                ? { text: "Paid", color: "#059669" }
                : live
                  ? { text: "Awaiting payment", color: "#d97706" }
                  : { text: "Not paid", color: "#6b7280" };

              return (
                <article
                  key={b.id}
                  className="slide-in bg-white rounded-2xl shadow overflow-hidden flex"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <div className="w-1.5 shrink-0" style={{ background: st.color }} />
                  <div className="flex-1 min-w-0 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base leading-tight">{b.task_type}</h3>
                        <p className="text-xs text-gray-700 mt-1 flex items-center gap-1.5 flex-wrap">
                          <Icon name={b.timing === "now" ? "bolt" : "calendar"} className="w-3.5 h-3.5" />
                          {b.timing === "now" ? "Immediate" : "Scheduled"}
                          <span aria-hidden="true">·</span>
                          {when(b.scheduled_at)}
                        </p>
                      </div>
                      <Pill text={st.label} color={st.color} />
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Amount</p>
                        <p className="text-2xl font-extrabold tracking-tight">{money(b.price)}</p>
                      </div>
                      <div className="text-right space-y-1">
                        <Pill text={pay.text} color={pay.color} />
                        <p className="text-[11px] text-gray-700 font-mono">#{b.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Person role="Customer" name={b.customer_name} phone={b.customer_phone} icon="user" empty="Customer" />
                      <Person role="Driver" name={b.driver_name} phone={b.driver_phone} icon="car" empty="Not assigned yet" />
                    </div>

                    {b.destination && (
                      <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 p-3">
                        <Icon name="pin" className="w-4 h-4 mt-0.5 text-indigo-700 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Destination</p>
                          <p className="text-sm font-semibold break-words">{b.destination}</p>
                        </div>
                      </div>
                    )}

                    {b.refund_status && b.refund_status !== "none" && (
                      <div
                        className="flex items-center gap-2.5 rounded-xl p-3 text-sm font-semibold"
                        style={{
                          background: `color-mix(in srgb, ${b.refund_status === "refunded" ? "#059669" : "#d97706"} 12%, var(--surface))`,
                          color: b.refund_status === "refunded" ? "#059669" : "#d97706",
                        }}
                      >
                        <Icon name="refund" className="w-4 h-4 shrink-0" />
                        {b.refund_status === "refunded" ? "Refund sent to the customer" : "Refund waiting to be sent"}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

          {canMore && (
            <button
              onClick={() => setLimit((l) => Math.min(MAX, l + STEP))}
              className="w-full bg-white border-2 border-indigo-300 font-bold rounded-xl p-3 active:scale-[0.98]"
            >
              Load more bookings
            </button>
          )}
        </section>
      </div>
    </main>
  );
}