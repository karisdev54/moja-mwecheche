"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";

const CATEGORIES = [
  { v: "app", label: "🛠️ App problem" },
  { v: "payment", label: "💳 Payment" },
  { v: "driver", label: "🚗 About a driver" },
  { v: "customer", label: "🙋 About a customer" },
  { v: "safety", label: "🚨 Safety" },
  { v: "other", label: "💬 Something else" },
];

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
  const [sent, setSent] = useState(false);

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
    const { error: e } = await supabase.from("reports").insert({
      user_id: uid,
      category,
      booking_id: booking || null,
      message: message.trim(),
    });
    setBusy(false);
    if (e) return setError(e.message);
    setSent(true);
  };

  if (!uid) return <Loader full />;

  if (sent) {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6 space-y-3 text-gray-900 text-center anim-rise">
          <p className="text-4xl">✅</p>
          <p className="text-xl font-bold">Report received</p>
          <p className="text-sm">Thank you. We will look into it and contact you if we need more details.</p>
          <Link href="/dashboard" className="block bg-indigo-600 text-white font-bold rounded-xl p-3">Back home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-md mx-auto space-y-4 text-gray-900 stagger">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Report a problem</h1>
          <Link href="/profile" className="text-sm underline font-semibold">Back</Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.v}
              type="button"
              onClick={() => setCategory(c.v)}
              className={`rounded-xl border-2 p-3 text-sm font-semibold ${
                category === c.v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {category === "safety" && (
          <p className="bg-red-50 border-2 border-red-200 text-red-700 rounded-xl p-3 text-sm font-semibold">
            In an emergency, call 999 or 112 first, then tell us here.
          </p>
        )}

        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold mb-1">Which trip? (optional)</p>
            <select className="w-full border-2 border-indigo-200 rounded-lg p-3" value={booking} onChange={(e) => setBooking(e.target.value)}>
              <option value="">Not about a specific trip</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.task_type} · {new Date(t.scheduled_at).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-sm font-semibold mb-1">What happened?</p>
            <textarea
              className="w-full border-2 border-indigo-200 rounded-lg p-3"
              rows={5}
              maxLength={1000}
              placeholder="Tell us what went wrong..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-right text-gray-700">{message.length}/1000</p>
          </div>
          {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="w-full bg-indigo-600 text-white font-bold rounded-lg p-4 disabled:opacity-60"
          >
            {busy ? "Sending..." : "Send report"}
          </button>
        </div>
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