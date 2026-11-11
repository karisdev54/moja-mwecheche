"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import { Icon, PageHeader, Tile } from "@/components/AdminUI";

const CATEGORIES = [
  { v: "app", label: "App problem", icon: "device", color: "#6366f1" },
  { v: "payment", label: "Payment", icon: "wallet", color: "#f59e0b" },
  { v: "driver", label: "About a driver", icon: "car", color: "#0ea5e9" },
  { v: "customer", label: "About a customer", icon: "user", color: "#8b5cf6" },
  { v: "safety", label: "Safety", icon: "alert", color: "#dc2626" },
  { v: "other", label: "Something else", icon: "help", color: "#64748b" },
];

const FIELD =
  "w-full border-2 border-indigo-200 rounded-xl p-3 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

type Trip = { id: string; task_type: string; scheduled_at: string };

function ReportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [uid, setUid] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [category, setCategory] = useState("app");
  const [booking, setBooking] = useState(params.get("booking") ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("bookings")
        .select("id,task_type,scheduled_at")
        .or(`customer_id.eq.${u.user.id},driver_id.eq.${u.user.id}`)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!active) return;
      setTrips((data ?? []) as Trip[]);
      setUid(u.user.id);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const submit = async () => {
    if (!uid || busy) return;
    setError("");
    if (message.trim().length < 10) return setError("Please describe the problem in at least 10 characters.");
    setBusy(true);
    const { data, error: e } = await supabase
      .from("reports")
      .insert({ user_id: uid, category, booking_id: booking || null, message: message.trim() })
      .select("id")
      .single();
    setBusy(false);
    if (e) return setError(e.message);
    setRef((data?.id ?? "").slice(0, 8).toUpperCase());
  };

  const again = () => {
    setRef("");
    setMessage("");
    setCategory("app");
    setBooking("");
  };

  if (!uid) return <Loader full />;

  if (ref !== "") {
    return (
      <main className="min-h-dvh flex items-center justify-center p-5" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center space-y-4 text-gray-900 pop-in">
          <div className="relative mx-auto w-20 h-20">
            <span className="pulse-ring absolute inset-0 rounded-full bg-green-400/50" />
            <svg viewBox="0 0 52 52" className="relative w-20 h-20">
              <circle className="check-circle" cx="26" cy="26" r="25" fill="none" stroke="#16a34a" strokeWidth="3" />
              <path className="check-tick" d="M14 27l8 8 16-16" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">Report received</h1>
            <p className="text-sm text-gray-700 mt-1">Thank you. We will look into it and contact you if we need more details.</p>
          </div>
          <div className="rounded-2xl bg-indigo-50 border-2 border-indigo-200 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Your reference</p>
            <p className="text-xl font-extrabold tracking-widest font-mono">#{ref}</p>
          </div>
          <div className="space-y-2">
            <Link href="/dashboard" className="btn-shine grad-bg block text-white font-bold rounded-2xl p-3.5 active:scale-[0.98]">
              Back home
            </Link>
            <button onClick={again} className="w-full bg-white border-2 border-indigo-200 font-bold rounded-2xl p-3 active:scale-[0.98]">
              Send another report
            </button>
          </div>
        </div>
      </main>
    );
  }

  const len = message.trim().length;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-md mx-auto space-y-5 text-gray-900">
        <PageHeader title="Report a problem" subtitle="Tell us what went wrong" href="/profile" />

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">What is it about?</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map((c) => {
              const on = category === c.v;
              return (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setCategory(c.v)}
                  aria-pressed={on}
                  className={`flex items-center gap-2.5 rounded-2xl border-2 bg-white p-3 text-left transition-all active:scale-95 ${
                    on ? "shadow-lg ring-4 ring-indigo-100" : "border-indigo-100"
                  }`}
                  style={on ? { borderColor: c.color } : undefined}
                >
                  <Tile name={c.icon} color={c.color} size="w-9 h-9" />
                  <span className="text-sm font-bold leading-tight">{c.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {category === "safety" && (
          <div
            className="slide-in rounded-2xl p-4 space-y-3"
            style={{ background: "color-mix(in srgb, #dc2626 10%, var(--surface))", border: "2px solid #dc2626" }}
          >
            <p className="flex items-center gap-2 font-bold text-red-700">
              <Icon name="alert" className="w-5 h-5" />
              In an emergency, call first
            </p>
            <div className="grid grid-cols-2 gap-2">
              {["999", "112"].map((n) => (
                <a key={n} href={`tel:${n}`} className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold rounded-xl p-3 active:scale-95">
                  <Icon name="phone" className="w-4 h-4" />
                  Call {n}
                </a>
              ))}
            </div>
            <p className="text-xs text-gray-800">Then tell us what happened below.</p>
          </div>
        )}

        <section className="bg-white rounded-2xl shadow p-4 space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Which trip? (optional)</p>
            <select className={FIELD} value={booking} onChange={(e) => setBooking(e.target.value)}>
              <option value="">Not about a specific trip</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.task_type}, {new Date(t.scheduled_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700">What happened?</p>
            <textarea
              className={FIELD}
              rows={5}
              maxLength={1000}
              placeholder="Tell us what went wrong"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError("");
              }}
            />
            <div className="flex items-center justify-between text-xs">
              <span className={len >= 10 ? "font-semibold text-green-700" : "text-gray-700"}>
                {len >= 10 ? "Looks good" : `${10 - len} more characters needed`}
              </span>
              <span className="text-gray-700">{message.length}/1000</span>
            </div>
          </div>
        </section>

        {error && (
          <p
            className="slide-in flex items-start gap-2 rounded-2xl bg-white shadow p-3 text-sm font-semibold text-red-700"
            style={{ borderLeft: "4px solid #dc2626" }}
          >
            <Icon name="alert" className="w-4 h-4 mt-0.5" />
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy ? (
            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <Icon name="send" className="w-5 h-5" />
          )}
          {busy ? "Sending..." : "Send report"}
        </button>
      </div>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportForm />
    </Suspense>
  );
}