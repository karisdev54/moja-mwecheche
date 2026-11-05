"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";

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

const STATUSES = [
  { v: "", label: "All" },
  { v: "requested", label: "Requested" },
  { v: "accepted", label: "Accepted" },
  { v: "in_progress", label: "In progress" },
  { v: "completed", label: "Completed" },
  { v: "cancelled", label: "Cancelled" },
  { v: "expired", label: "Expired" },
];

const STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-900",
  accepted: "bg-blue-100 text-blue-900",
  in_progress: "bg-violet-100 text-violet-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-gray-200 text-gray-900",
  expired: "bg-red-100 text-red-900",
};

export default function AdminBookingsPage() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState("");
  const [res, setRes] = useState<Res | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setApplied(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const key = `${status}|${applied}`;

  useEffect(() => {
    let active = true;
    supabase.rpc("admin_bookings", { p_status: status, p_search: applied, p_limit: 60 }).then(({ data, error }) => {
      if (active) setRes({ key, rows: (data ?? []) as B[], error: error?.message ?? "" });
    });
    return () => {
      active = false;
    };
  }, [key, status, applied]);

  const loading = !res || res.key !== key;

  if (res && res.error.includes("Not allowed")) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-4 text-gray-900">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <AdminNav />

        <input
          className="w-full border-2 border-indigo-200 rounded-xl p-3"
          placeholder="Search customer, driver, phone or destination"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUSES.map((s) => (
            <button
              key={s.v}
              onClick={() => setStatus(s.v)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 ${
                status === s.v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading && <Loader label="Loading bookings" />}
        {!loading && res?.error && <p className="text-red-600">{res.error}</p>}
        {!loading && res && res.rows.length === 0 && !res.error && <p>No bookings match.</p>}

        {!loading &&
          res?.rows.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl shadow p-4 space-y-1 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-bold">{b.task_type}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${STYLE[b.status] ?? "bg-gray-200"}`}>
                  {b.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-gray-700">
                {b.timing === "now" ? "⚡ Now" : "📅 Later"} · {new Date(b.scheduled_at).toLocaleString()} · KES {Number(b.price).toLocaleString()}
                {b.paid && <span className="ml-2 text-green-700 font-semibold">Paid ✓</span>}
              </p>
              <p>🙋 {b.customer_name || "Customer"} {b.customer_phone && <span className="text-gray-700">· {b.customer_phone}</span>}</p>
              <p>🚗 {b.driver_name ? `${b.driver_name}${b.driver_phone ? ` · ${b.driver_phone}` : ""}` : "No driver yet"}</p>
              {b.destination && <p className="truncate">📍 {b.destination}</p>}
              {b.refund_status !== "none" && (
                <p className="font-semibold text-indigo-800">Refund: {b.refund_status}</p>
              )}
            </div>
          ))}
      </div>
    </main>
  );
}