"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";
import AdminTodo from "@/components/AdminTodo";
import { Empty, Icon, PageHeader, PersonRow, Pill, Stat, Tile } from "@/components/AdminUI";
import { promptDialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import Avatar from "@/components/Avatar";

type Report = {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
  admin_note: string | null;
  user: { full_name: string | null; phone: string | null; role: string; avatar_url: string | null } | null;
  booking: { task_type: string; scheduled_at: string } | null;
};
type State = { allowed: boolean; items: Report[]; at: number };

const CAT: Record<string, { label: string; icon: string; color: string }> = {
  app: { label: "App problem", icon: "device", color: "#6366f1" },
  payment: { label: "Payment", icon: "wallet", color: "#f59e0b" },
  driver: { label: "About a driver", icon: "car", color: "#0ea5e9" },
  customer: { label: "About a customer", icon: "user", color: "#8b5cf6" },
  safety: { label: "Safety", icon: "alert", color: "#dc2626" },
  other: { label: "Other", icon: "help", color: "#64748b" },
};

const FILTERS = ["Open", "Safety", "Resolved", "All"] as const;
type Filter = (typeof FILTERS)[number];

const nowIso = () => new Date().toISOString();

function ago(iso: string, now: number) {
  const s = Math.max(1, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString();
}

async function fetchReports(): Promise<State> {
  const none: State = { allowed: false, items: [], at: Date.now() };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return none;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (me?.role !== "admin") return none;

  const { data } = await supabase
    .from("reports")
    .select(
      "id,category,message,status,created_at,admin_note,user:user_id(full_name,phone,role,avatar_url),booking:booking_id(task_type,scheduled_at)"
    )
    .order("created_at", { ascending: false })
    .limit(80);
  return { allowed: true, items: (data ?? []) as unknown as Report[], at: Date.now() };
}

export default function AdminReportsPage() {
  const [state, setState] = useState<State | null>(null);
  const [filter, setFilter] = useState<Filter>("Open");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchReports().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const resolve = async (r: Report) => {
    const note = await promptDialog({
      title: "Mark as resolved",
      message: "Add a note about how you handled it (optional).",
      placeholder: "What was done",
      multiline: true,
      confirmText: "Mark resolved",
    });
    if (note === null) return;

    setBusyId(r.id);
    const { error } = await supabase
      .from("reports")
      .update({ status: "resolved", resolved_at: nowIso(), admin_note: note.trim() || null })
      .eq("id", r.id);
    setBusyId(null);
    if (error) {
      toast(error.message, { tone: "danger" });
      return;
    }
    toast("Report resolved", { tone: "ok" });
    fetchReports().then(setState);
  };

  if (!state) return <Loader full />;
  if (!state.allowed) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const open = state.items.filter((r) => r.status === "open");
  const safety = open.filter((r) => r.category === "safety");
  const resolved = state.items.filter((r) => r.status === "resolved");

  const counts: Record<Filter, number> = {
    Open: open.length,
    Safety: safety.length,
    Resolved: resolved.length,
    All: state.items.length,
  };
  const shown = filter === "Open" ? open : filter === "Safety" ? safety : filter === "Resolved" ? resolved : state.items;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <PageHeader title="Reports" subtitle="Problems sent in by users" />
        <AdminNav />
        <AdminTodo kind="reports" />

        <div className="grid grid-cols-3 gap-3">
          <Stat icon="flag" color="#d97706" label="Open" value={open.length} />
          <Stat icon="alert" color="#dc2626" label="Safety" value={safety.length} />
          <Stat icon="check" color="#059669" label="Resolved" value={resolved.length} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold border-2 ${
                  on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
                }`}
              >
                {f}
                <span
                  className={`min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                    on ? "bg-white/25" : "bg-indigo-100 text-indigo-800"
                  }`}
                >
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>

        {shown.length === 0 && (
          <Empty
            icon={filter === "Resolved" ? "inbox" : "check"}
            title={filter === "Resolved" ? "Nothing resolved yet" : "All caught up"}
            text={filter === "Resolved" ? "Resolved reports will appear here." : "No reports in this list."}
          />
        )}

        {shown.map((r, i) => {
          const c = CAT[r.category] ?? CAT.other;
          const isOpen = r.status === "open";
          const urgent = isOpen && r.category === "safety";
          const bar = isOpen ? c.color : "#059669";
          return (
            <article
              key={r.id}
              className="slide-in bg-white rounded-2xl shadow overflow-hidden flex"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <div className="w-1.5 shrink-0" style={{ background: bar }} />
              <div className="flex-1 min-w-0 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Tile name={c.icon} color={c.color} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold leading-tight">{c.label}</h3>
                    <p className="text-xs text-gray-700">{ago(r.created_at, state.at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill text={isOpen ? "Open" : "Resolved"} color={isOpen ? "#d97706" : "#059669"} />
                    {urgent && <Pill text="Urgent" color="#dc2626" />}
                  </div>
                </div>

                <p className="text-sm break-words rounded-xl bg-indigo-50 p-3">{r.message}</p>

                {r.booking && (
                  <p className="text-xs text-gray-700 flex items-center gap-1.5">
                    <Icon name="car" className="w-3.5 h-3.5" />
                    About the trip: {r.booking.task_type},{" "}
                    {new Date(r.booking.scheduled_at).toLocaleDateString()}
                  </p>
                )}

                <PersonRow
                  role={r.user?.role ? `Reported by, ${r.user.role}` : "Reported by"}
                  name={r.user?.full_name}
                  phone={r.user?.phone}
                  avatar={r.user?.avatar_url}
                  empty="Deleted account"
                />

                {r.admin_note && (
                  <p className="flex items-start gap-2 rounded-xl bg-green-50 text-green-800 text-sm font-semibold p-3">
                    <Icon name="check" className="w-4 h-4 mt-0.5" />
                    {r.admin_note}
                  </p>
                )}

                {isOpen && (
                  <button
                    onClick={() => resolve(r)}
                    disabled={busyId === r.id}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold rounded-xl p-3.5 disabled:opacity-50 active:scale-[0.98]"
                  >
                    <Icon name="check" className="w-4 h-4" />
                    Mark resolved
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}