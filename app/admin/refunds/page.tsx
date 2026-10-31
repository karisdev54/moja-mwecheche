"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";

type Refund = {
  id: string;
  task_type: string;
  scheduled_at: string;
  refund_amount: number | null;
  refund_status: string;
  refund_reference: string | null;
  customer: { full_name: string | null; phone: string | null } | null;
  receipt: string | null;
  pay_phone: string | null;
};
type State = { allowed: boolean; items: Refund[] };

async function fetchRefunds(): Promise<State> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { allowed: false, items: [] };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (me?.role !== "admin") return { allowed: false, items: [] };

  const { data } = await supabase
    .from("bookings")
    .select("id,task_type,scheduled_at,refund_amount,refund_status,refund_reference,customer:customer_id(full_name,phone)")
    .in("refund_status", ["needed", "refunded"])
    .order("created_at", { ascending: false })
    .limit(40);
  const rows = (data ?? []) as unknown as Omit<Refund, "receipt" | "pay_phone">[];

  let pays: { booking_id: string; mpesa_receipt: string | null; phone: string }[] = [];
  if (rows.length > 0) {
    const { data: p } = await supabase
      .from("payments")
      .select("booking_id,mpesa_receipt,phone")
      .eq("status", "success")
      .in("booking_id", rows.map((r) => r.id));
    pays = (p ?? []) as typeof pays;
  }

  return {
    allowed: true,
    items: rows.map((r) => {
      const pay = pays.find((x) => x.booking_id === r.id);
      return {
        ...r,
        refund_amount: r.refund_amount === null ? null : Number(r.refund_amount),
        receipt: pay?.mpesa_receipt ?? null,
        pay_phone: pay?.phone ?? null,
      };
    }),
  };
}

export default function RefundsPage() {
  const [state, setState] = useState<State | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchRefunds().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const save = async (id: string) => {
    setMsg("");
    if (ref.trim().length < 5) {
      setMsg("Enter the M-Pesa code of the refund you sent.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_mark_refunded", {
      p_booking: id,
      p_reference: ref,
      p_note: note,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setOpenId(null);
    setRef("");
    setNote("");
    fetchRefunds().then(setState);
  };

  if (!state) return <Loader full />;
  if (!state.allowed) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const pending = state.items.filter((r) => r.refund_status === "needed");
  const done = state.items.filter((r) => r.refund_status === "refunded");

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Refunds</h1>
          <Link href="/admin" className="text-sm underline">Back to admin</Link>
        </div>

        <h2 className="text-lg font-bold">Waiting for refund ({pending.length})</h2>
        {pending.length === 0 && <p className="text-gray-700">No refunds waiting.</p>}
        {pending.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl shadow p-4 space-y-2 text-gray-900">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{r.customer?.full_name || "Customer"}</p>
                <p className="text-sm text-gray-700">{r.task_type} · {new Date(r.scheduled_at).toLocaleString()}</p>
              </div>
              <p className="text-lg font-bold">KES {(r.refund_amount ?? 0).toLocaleString()}</p>
            </div>
            <p className="text-sm text-gray-800">
              Paid from: <b>{r.pay_phone || "unknown"}</b> · Receipt: <b>{r.receipt || "not recorded"}</b>
            </p>
            <p className="text-sm text-gray-800">Customer phone: {r.customer?.phone || "none"}</p>

            {openId !== r.id ? (
              <button onClick={() => { setOpenId(r.id); setMsg(""); }} className="w-full bg-black text-white rounded-lg p-3">
                Record refund
              </button>
            ) : (
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs text-gray-700">
                  First send KES {(r.refund_amount ?? 0).toLocaleString()} to {r.pay_phone || "the customer"} from your M-Pesa (or reverse the transaction), then enter the code.
                </p>
                <input className="w-full border rounded-lg p-2" placeholder="M-Pesa code of the refund" value={ref} onChange={(e) => setRef(e.target.value)} />
                <input className="w-full border rounded-lg p-2" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                {msg && <p className="text-red-600 text-sm">{msg}</p>}
                <div className="flex gap-2">
                  <button onClick={() => save(r.id)} disabled={busy} className="flex-1 bg-green-600 text-white rounded-lg p-3 disabled:opacity-50">
                    {busy ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setOpenId(null)} className="flex-1 border rounded-lg p-3">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}

        <h2 className="text-lg font-bold pt-2">Refunded</h2>
        {done.length === 0 && <p className="text-gray-700">None yet.</p>}
        {done.map((r) => (
          <div key={r.id} className="bg-white rounded-xl shadow p-3 text-sm text-gray-900 flex justify-between">
            <div>
              <p className="font-semibold">{r.customer?.full_name || "Customer"}</p>
              <p className="text-gray-700">{r.refund_reference} · {r.task_type}</p>
            </div>
            <p className="font-semibold">KES {(r.refund_amount ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </main>
  );
}