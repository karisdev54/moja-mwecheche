"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";
import { Skeleton } from "@/components/Loader";
import PlateBadge from "@/components/PlateBadge";
import { Empty, Icon, PageHeader, Pill, Stat } from "@/components/AdminUI";
import { alertDialog, confirmDialog, promptDialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";

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

const STEP = 60;
const MAX = 200;

const ROLES = [
  { v: "", label: "Everyone" },
  { v: "customer", label: "Customers" },
  { v: "driver", label: "Drivers" },
];

const ROLE_COLOR: Record<string, string> = { customer: "#0ea5e9", driver: "#6366f1", admin: "#8b5cf6" };
const ROLE_LABEL: Record<string, string> = { customer: "Customer", driver: "Driver", admin: "Admin" };

const VERIFY: Record<string, { text: string; color: string }> = {
  approved: { text: "Verified", color: "#059669" },
  pending: { text: "Pending review", color: "#d97706" },
  rejected: { text: "Rejected", color: "#dc2626" },
  unsubmitted: { text: "No documents", color: "#6b7280" },
};

function Line({ icon, children, action }: { icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-indigo-600">
        <Icon name={icon} className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {action}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3">
      <div className="flex gap-3">
        <Skeleton className="w-11 h-11 !rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export default function UsersPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [role, setRole] = useState("");
  const [onlySusp, setOnlySusp] = useState(false);
  const [limit, setLimit] = useState(STEP);
  const [tick, setTick] = useState(0);
  const [res, setRes] = useState<Res | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const key = `${role}|${applied}|${limit}|${tick}`;

  useEffect(() => {
    if (allowed !== true) return;
    let active = true;
    supabase.rpc("admin_users", { p_search: applied, p_role: role, p_limit: limit }).then(({ data, error }) => {
      if (active) setRes({ key, rows: (data ?? []) as U[], error: error?.message ?? "" });
    });
    return () => {
      active = false;
    };
  }, [allowed, key, applied, role, limit]);

  const toggle = async (u: U) => {
    let reason: string | null = null;
    if (!u.suspended) {
      reason = await promptDialog({
        title: `Suspend ${u.full_name || "this user"}?`,
        message: "They will lose all access to the app and will see this reason.",
        placeholder: "Reason, for example: fake documents",
        multiline: true,
        required: true,
        minLength: 5,
        confirmText: "Suspend account",
        danger: true,
      });
      if (reason === null) return;
    } else {
      const ok = await confirmDialog({
        title: `Reinstate ${u.full_name || "this user"}?`,
        message: "They will be able to use the app again.",
        confirmText: "Reinstate",
      });
      if (!ok) return;
    }

    setBusyId(u.id);
    const { error } = await supabase.rpc("admin_set_suspended", {
      p_user: u.id,
      p_suspended: !u.suspended,
      p_reason: reason,
    });
    setBusyId(null);
    if (error) {
      await alertDialog({ title: "Could not update the account", message: error.message });
      return;
    }
    toast(u.suspended ? "Account reinstated" : "Account suspended", { tone: u.suspended ? "ok" : "warn" });
    setTick((t) => t + 1);
  };

  if (allowed === false) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const loading = allowed === null || !res || res.key !== key;
  const all = res && res.key === key ? res.rows : [];
  const rows = onlySusp ? all.filter((u) => u.suspended) : all;
  const canMore = !loading && all.length >= limit && limit < MAX;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <PageHeader title="Users" subtitle="Search, review and suspend accounts" />
        <AdminNav />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon="users" color="#6366f1" label="Showing" value={rows.length} loading={loading} />
          <Stat icon="user" color="#0ea5e9" label="Customers" value={rows.filter((u) => u.role === "customer").length} loading={loading} />
          <Stat icon="car" color="#8b5cf6" label="Drivers" value={rows.filter((u) => u.role === "driver").length} loading={loading} />
          <Stat icon="ban" color="#dc2626" label="Suspended" value={rows.filter((u) => u.suspended).length} loading={loading} />
        </div>

        <section className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 w-12 flex items-center justify-center text-gray-700 pointer-events-none">
              <Icon name="search" className="w-5 h-5" />
            </span>
            <input
              className="w-full border-2 border-indigo-200 rounded-xl p-3 pl-12 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              placeholder="Search name, phone, email or number plate"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ROLES.map((r) => (
              <button
                key={r.v}
                onClick={() => {
                  setRole(r.v);
                  setLimit(STEP);
                }}
                className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold border-2 ${
                  role === r.v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
                }`}
              >
                {r.label}
              </button>
            ))}
            <button
              onClick={() => setOnlySusp((s) => !s)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border-2 ${
                onlySusp ? "bg-red-600 text-white border-red-600" : "bg-white border-red-200 text-red-700"
              }`}
            >
              <Icon name="ban" className="w-4 h-4" />
              Suspended only
            </button>
          </div>
        </section>

        {res?.error && !loading && (
          <div className="bg-white rounded-2xl shadow p-4 flex gap-3 items-start" style={{ borderLeft: "4px solid #dc2626" }}>
            <Icon name="alert" className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-bold">Could not load users</p>
              <p className="text-sm text-gray-700">{res.error}</p>
            </div>
          </div>
        )}

        {loading && (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        )}

        {!loading && !res?.error && rows.length === 0 && (
          <Empty icon="users" title="No users found" text="Try a different search or filter." />
        )}

        {!loading &&
          rows.map((u, i) => {
            const color = u.suspended ? "#dc2626" : ROLE_COLOR[u.role] ?? "#6b7280";
            const v = u.role === "driver" ? VERIFY[u.verification_status ?? "unsubmitted"] : null;
            return (
              <article
                key={u.id}
                className="slide-in bg-white rounded-2xl shadow overflow-hidden flex"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className="w-1.5 shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="w-11 h-11 rounded-full flex items-center justify-center text-base font-extrabold text-white shrink-0"
                      style={{ background: color }}
                    >
                      {(u.full_name || u.email || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold leading-tight truncate">{u.full_name || "Unnamed"}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Pill text={ROLE_LABEL[u.role] ?? u.role} color={ROLE_COLOR[u.role] ?? "#6b7280"} />
                        {v && <Pill text={v.text} color={v.color} />}
                        {u.is_available && <Pill text="Online" color="#059669" />}
                        {u.suspended && <Pill text="Suspended" color="#dc2626" />}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Line
                      icon="phone"
                      action={
                        u.phone ? (
                          <a
                            href={`tel:${u.phone}`}
                            aria-label={`Call ${u.full_name ?? "user"}`}
                            className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 active:scale-90"
                          >
                            <Icon name="phone" className="w-4 h-4" />
                          </a>
                        ) : undefined
                      }
                    >
                      {u.phone || "No phone saved"}
                    </Line>
                    <Line icon="mail">{u.email || "No email"}</Line>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {u.has_car && u.car_plate && <PlateBadge plate={u.car_plate} small />}
                    {u.has_car === false && <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold">No car</span>}
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold">
                      {u.jobs_done} job{u.jobs_done === 1 ? "" : "s"}
                    </span>
                    {u.avg_rating !== null && (
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold">
                        {Number(u.avg_rating).toFixed(1)} rating
                      </span>
                    )}
                    <span className="text-gray-700">Joined {new Date(u.created_at).toLocaleDateString()}</span>
                  </div>

                  {u.suspended && u.suspended_reason && (
                    <p
                      className="flex items-start gap-2 rounded-xl p-3 text-sm font-semibold"
                      style={{ background: "color-mix(in srgb, #dc2626 10%, var(--surface))", color: "#dc2626" }}
                    >
                      <Icon name="info" className="w-4 h-4 mt-0.5" />
                      {u.suspended_reason}
                    </p>
                  )}

                  {u.role !== "admin" && (
                    <button
                      onClick={() => toggle(u)}
                      disabled={busyId === u.id}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl p-3 font-bold disabled:opacity-50 active:scale-[0.98] ${
                        u.suspended ? "bg-green-600 text-white" : "bg-white border-2 border-red-300 text-red-700"
                      }`}
                    >
                      <Icon name={u.suspended ? "undo" : "ban"} className="w-4 h-4" />
                      {u.suspended ? "Reinstate account" : "Suspend account"}
                    </button>
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
            Load more users
          </button>
        )}
      </div>
    </main>
  );
}