"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";
import PlateBadge from "@/components/PlateBadge";

type U = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  suspended: boolean;
  suspended_reason: string | null;
  created_at: string;
  has_car: boolean | null;
  car_plate: string | null;
  verification_status: string | null;
  is_available: boolean | null;
  jobs_done: number;
  avg_rating: number | null;
};
type Res = { key: string; rows: U[]; error: string };

const ROLES = [
  { v: "", label: "Everyone" },
  { v: "customer", label: "Customers" },
  { v: "driver", label: "Drivers" },
];

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [role, setRole] = useState("");
  const [tick, setTick] = useState(0);
  const [res, setRes] = useState<Res | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setApplied(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const key = `${role}|${applied}|${tick}`;

  useEffect(() => {
    let active = true;
    supabase.rpc("admin_users", { p_search: applied, p_role: role, p_limit: 60 }).then(({ data, error }) => {
      if (active) setRes({ key, rows: (data ?? []) as U[], error: error?.message ?? "" });
    });
    return () => {
      active = false;
    };
  }, [key, applied, role]);

  const loading = !res || res.key !== key;

  const toggle = async (u: U) => {
    let reason: string | null = null;
    if (!u.suspended) {
      reason = window.prompt(`Why are you suspending ${u.full_name || "this user"}? They will see this reason.`);
      if (reason === null) return;
      if (!reason.trim()) return alert("Please give a reason.");
    } else if (!window.confirm("Reinstate this account?")) {
      return;
    }
    setBusyId(u.id);
    const { error } = await supabase.rpc("admin_set_suspended", {
      p_user: u.id,
      p_suspended: !u.suspended,
      p_reason: reason,
    });
    setBusyId(null);
    if (error) return alert(error.message);
    setTick((t) => t + 1);
  };

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
        <h1 className="text-2xl font-bold">Users</h1>
        <AdminNav />

        <input
          className="w-full border-2 border-indigo-200 rounded-xl p-3"
          placeholder="Search name, phone, email or number plate"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-2">
          {ROLES.map((r) => (
            <button
              key={r.v}
              onClick={() => setRole(r.v)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-2 ${
                role === r.v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading && <Loader label="Loading users" />}
        {!loading && res?.error && <p className="text-red-600">{res.error}</p>}
        {!loading && res && res.rows.length === 0 && !res.error && <p>No users match.</p>}

        {!loading &&
          res?.rows.map((u) => (
            <div key={u.id} className={`bg-white rounded-2xl shadow p-4 space-y-2 text-sm ${u.suspended ? "border-2 border-red-400" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-base truncate">{u.full_name || "Unnamed"}</p>
                  <p className="text-xs text-indigo-700 font-semibold capitalize">
                    {u.role}
                    {u.role === "driver" && u.verification_status ? ` · ${u.verification_status}` : ""}
                    {u.role === "driver" && u.is_available ? " · 🟢 online" : ""}
                  </p>
                </div>
                {u.suspended && <span className="text-xs font-bold bg-red-100 text-red-800 rounded-full px-2 py-1">Suspended</span>}
              </div>

              <p>📞 {u.phone || "No phone"} {u.phone && <a href={`tel:${u.phone}`} className="ml-2 underline font-semibold text-blue-700">Call</a>}</p>
              <p className="truncate">✉️ {u.email || "No email"}</p>

              <div className="flex items-center gap-2 flex-wrap">
                {u.has_car && u.car_plate && <PlateBadge plate={u.car_plate} small />}
                {u.has_car === false && <span>🚶 No car</span>}
                <span>✅ {u.jobs_done} job{u.jobs_done === 1 ? "" : "s"}</span>
                {u.avg_rating !== null && <span>★ {Number(u.avg_rating).toFixed(1)}</span>}
                <span className="text-xs text-gray-700">Joined {new Date(u.created_at).toLocaleDateString()}</span>
              </div>

              {u.suspended && u.suspended_reason && <p className="text-red-700">Reason: {u.suspended_reason}</p>}

              {u.role !== "admin" && (
                <button
                  onClick={() => toggle(u)}
                  disabled={busyId === u.id}
                  className={`w-full rounded-lg p-3 font-bold disabled:opacity-50 ${
                    u.suspended ? "bg-green-600 text-white" : "bg-white border-2 border-red-300 text-red-700"
                  }`}
                >
                  {u.suspended ? "Reinstate account" : "Suspend account"}
                </button>
              )}
            </div>
          ))}
      </div>
    </main>
  );
}