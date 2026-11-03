"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminTodo from "@/components/AdminTodo";

type Balance = {
  driver_id: string;
  full_name: string | null;
  phone: string | null;
  earned: number;
  paid_out: number;
  owed: number;
};
type Payout = {
  id: string;
  amount: number;
  mpesa_reference: string | null;
  note: string | null;
  created_at: string;
  driver: { full_name: string | null } | null;
};
type State = { allowed: boolean; balances: Balance[]; payouts: Payout[]; commission: number };

const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

async function fetchAll(): Promise<State> {
  const empty: State = { allowed: false, balances: [], payouts: [], commission: 0 };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return empty;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (me?.role !== "admin") return empty;

  const { data: bal } = await supabase.rpc("admin_driver_balances");
  const { data: pay } = await supabase
    .from("payouts")
    .select("id,amount,mpesa_reference,note,created_at,driver:driver_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: stats } = await supabase.rpc("admin_stats", { p_days: 0 });

  return {
    allowed: true,
    commission: Number((stats as { commission?: number } | null)?.commission ?? 0),
    balances: ((bal ?? []) as Balance[]).map((b) => ({
      ...b,
      earned: Number(b.earned),
      paid_out: Number(b.paid_out),
      owed: Number(b.owed),
    })),
    payouts: ((pay ?? []) as unknown as Payout[]).map((p) => ({ ...p, amount: Number(p.amount) })),
  };
}

export default function PayoutsPage() {
  const [state, setState] = useState<State | null>(null);
  const [help, setHelp] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAll().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const start = (b: Balance) => {
    setOpenId(b.driver_id);
    setAmount(String(b.owed));
    setRef("");
    setNote("");
    setMsg("");
  };

  const save = async (b: Balance) => {
    if (busy) return;
    setMsg("");
    const value = Number(amount);
    if (!value || value <= 0) return setMsg("Enter an amount greater than 0.");
    if (value > b.owed) return setMsg(`You only owe this driver ${kes(b.owed)}.`);
    if (ref.trim().length < 5) return setMsg("Enter the M-Pesa confirmation code of the money you sent.");

    setBusy(true);
    const { error } = await supabase.from("payouts").insert({
      driver_id: b.driver_id,
      amount: value,
      mpesa_reference: ref.trim().toUpperCase(),
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    setOpenId(null);
    fetchAll().then(setState);
  };

  if (!state) return <Loader full />;
  if (!state.allowed) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const totalOwed = state.balances.reduce((s, b) => s + Math.max(b.owed, 0), 0);
  const totalPaid = state.balances.reduce((s, b) => s + b.paid_out, 0);

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-4 text-gray-900">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Driver payouts</h1>
          <AdminTodo kind="payouts" />
          <Link href="/admin" className="text-sm underline">Back to admin</Link>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 space-y-2">
          <button onClick={() => setHelp((h) => !h)} className="w-full flex justify-between font-bold">
            <span>How does this page work?</span>
            <span className="text-sm">{help ? "Hide ▲" : "Show ▼"}</span>
          </button>
          {help && (
            <div className="text-sm space-y-2">
              <p><b>1. Customers pay you.</b> The full price goes into your M-Pesa till.</p>
              <p><b>2. The price is split</b> when a job is completed. You keep 15% as commission. The driver earns 85%.</p>
              <p><b>3. The driver&apos;s 85% is &quot;owed&quot;</b> until you send it to them.</p>
              <p><b>4. You send the money yourself</b> from your M-Pesa, then press <b>I sent the money</b> below and type the confirmation code. That lowers what you owe.</p>
              <p className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-2">
                Example: a KES 2,000 job gives you KES 300 and the driver KES 1,700. This page <b>does not send money</b>. It only keeps the record.
              </p>
              <p className="text-xs">Only completed and paid jobs count. Cancelled, refunded and unfinished jobs are not included.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl shadow p-3">
            <p className="text-xs text-gray-700">You owe drivers</p>
            <p className="text-lg font-extrabold text-red-600">{kes(totalOwed)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-3">
            <p className="text-xs text-gray-700">Already paid</p>
            <p className="text-lg font-extrabold text-green-700">{kes(totalPaid)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-3">
            <p className="text-xs text-gray-700">Your commission</p>
            <p className="text-lg font-extrabold text-indigo-800">{kes(state.commission)}</p>
          </div>
        </div>

        <h2 className="text-lg font-bold">Drivers</h2>
        {state.balances.length === 0 && <p>No drivers yet.</p>}

        {state.balances.map((b) => (
          <div key={b.driver_id} className="bg-white rounded-2xl shadow p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{b.full_name || "Unnamed driver"}</p>
                <p className="text-sm text-gray-700">{b.phone || "No phone"}</p>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-bold ${
                  b.owed > 0 ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"
                }`}
              >
                {b.owed > 0 ? "Waiting for payment" : "All paid"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-indigo-50 rounded-lg p-2">
                <p className="text-gray-700">Earned</p>
                <p className="font-bold text-sm">{kes(b.earned)}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-2">
                <p className="text-gray-700">You paid</p>
                <p className="font-bold text-sm">{kes(b.paid_out)}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-2">
                <p className="text-gray-700">Still owed</p>
                <p className="font-bold text-sm text-red-600">{kes(b.owed)}</p>
              </div>
            </div>

            {b.owed > 0 && openId !== b.driver_id && (
              <button onClick={() => start(b)} className="w-full bg-indigo-600 text-white font-bold rounded-lg p-3">
                I sent the money, record it
              </button>
            )}

            {openId === b.driver_id && (
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs">
                  Step 1: send the money to <b>{b.phone || "the driver"}</b> from your M-Pesa. Step 2: fill this in.
                </p>
                <input type="number" className="w-full border-2 border-indigo-200 rounded-lg p-3" placeholder="How much did you send? (KES)" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <input className="w-full border-2 border-indigo-200 rounded-lg p-3" placeholder="M-Pesa confirmation code" value={ref} onChange={(e) => setRef(e.target.value)} />
                <input className="w-full border-2 border-indigo-200 rounded-lg p-3" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                {msg && <p className="text-red-600 text-sm font-semibold">{msg}</p>}
                <div className="flex gap-2">
                  <button onClick={() => save(b)} disabled={busy} className="flex-1 bg-green-600 text-white font-bold rounded-lg p-3 disabled:opacity-60">
                    {busy ? "Saving..." : "Save record"}
                  </button>
                  <button onClick={() => setOpenId(null)} className="flex-1 bg-white border-2 border-indigo-200 font-semibold rounded-lg p-3">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        <h2 className="text-lg font-bold pt-2">Payments you sent to drivers</h2>
        {state.payouts.length === 0 && <p>Nothing recorded yet.</p>}
        {state.payouts.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow p-3 text-sm flex justify-between gap-3">
            <div>
              <p className="font-semibold">{p.driver?.full_name || "Driver"}</p>
              <p className="text-gray-700">
                {p.mpesa_reference} · {new Date(p.created_at).toLocaleDateString()}
                {p.note ? ` · ${p.note}` : ""}
              </p>
            </div>
            <p className="font-bold">{kes(p.amount)}</p>
          </div>
        ))}
      </div>
    </main>
  );
}