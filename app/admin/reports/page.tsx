"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";

type Report = {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
  user: { full_name: string | null; phone: string | null; role: string } | null;
  booking: { task_type: string; scheduled_at: string } | null;
};
type State = { allowed: boolean; items: Report[] };

async function fetchReports(): Promise<State> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { allowed: false, items: [] };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (me?.role !== "admin") return { allowed: false, items: [] };

  const { data } = await supabase
    .from("reports")
    .select("id,category,message,status,created_at,user:user_id(full_name,phone,role),booking:booking_id(task_type,scheduled_at)")
    .order("created_at", { ascending: false })
    .limit(60);
  return { allowed: true, items: (data ?? []) as unknown as Report[] };
}

export default function AdminReportsPage() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let active = true;
    fetchReports().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const resolve = async (id: string) => {
    const note = window.prompt("Note about how it was handled (optional):") ?? "";
    await supabase
      .from("reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), admin_note: note.trim() || null })
      .eq("id", id);
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
  const done = state.items.filter((r) => r.status === "resolved");

  const Card = ({ r }: { r: Report }) => (
    <div className={`bg-white rounded-2xl shadow p-4 space-y-1 text-sm ${r.category === "safety" ? "border-2 border-red-400" : ""}`}>
      <div className="flex justify-between">
        <span className="font-bold capitalize">{r.category}</span>
        <span className="text-xs">{new Date(r.created_at).toLocaleString()}</span>
      </div>
      <p className="text-gray-800">
        {r.user?.full_name || "User"} ({r.user?.role}) · {r.user?.phone || "no phone"}
      </p>
      {r.booking && <p className="text-xs">Trip: {r.booking.task_type} · {new Date(r.booking.scheduled_at).toLocaleDateString()}</p>}
      <p className="pt-1">{r.message}</p>
      {r.status === "open" && (
        <button onClick={() => resolve(r.id)} className="mt-2 w-full bg-green-600 text-white font-bold rounded-lg p-3">
          Mark resolved
        </button>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4 text-gray-900">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Reports</h1>
          <Link href="/admin" className="text-sm underline">Back to admin</Link>
        </div>
        <h2 className="text-lg font-bold">Open ({open.length})</h2>
        {open.length === 0 && <p>No open reports.</p>}
        {open.map((r) => <Card key={r.id} r={r} />)}
        <h2 className="text-lg font-bold pt-2">Resolved</h2>
        {done.map((r) => <Card key={r.id} r={r} />)}
      </div>
    </main>
  );
}