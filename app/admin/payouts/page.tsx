"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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
type State = { allowed: boolean; balances: Balance[]; payouts: Payout[] };

async function fetchAll(): Promise<State> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { allowed: false, balances: [], payouts: [] };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", u.user.id)
    .maybeSingle();
  if (me?.role !== "admin") return { allowed: false, balances: [], payouts: [] };

  const { data: bal } = await supabase.rpc("admin_driver_balances");
  const { data: pay } = await supabase
    .from("payouts")
    .select("id,amount,mpesa_reference,note,created_at,driver:driver_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(20);

  const balances = ((bal ?? []) as Balance[]).map((b) => ({
    ...b,
    earned: Number(b.earned),
    paid_out: Number(b.paid_out),
    owed: Number(b.owed),
  }));
  const payouts = ((pay ?? []) as unknown as Payout[]).map((p) => ({
    ...p,
    amount: Number(p.amount),
  }));
  return { allowed: true, balances, payouts };
}

export default function PayoutsPage() {
  const [state, setState] = useState<State | null>(null);
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

  const startPayout = (b: Balance) => {
    setOpenId(b.driver_id);
    setAmount(String(b.owed));
    setRef("");
    setNote("");
    setMsg("");
  };

  const save = async (b: Balance) => {
    setMsg("");
    const value = Number(amount);
    if (!value || value <= 0) {
      setMsg("Enter an amount greater than 0.");
      return;
    }
    if (value > b.owed) {
      setMsg(`You only owe KES ${b.owed}.`);
      return;
    }
    if (ref.trim().length < 5) {
      setMsg("Enter the M-Pesa transaction code you sent.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("payouts").insert({
      driver_id: b.driver_id,
      amount: value,
      mpesa_reference: ref.trim().toUpperCase(),
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setOpenId(null);
    fetchAll().then(setState);
  };

  if (!state) return <p className="p-6">Loading...</p>;
  if (!state.allowed) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const totalOwed = state.balances.reduce((s, b) => s + Math.max(b.owed, 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Driver payouts</h1>
          <Link href="/admin" className="text-sm underline">Back to admin</Link>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-sm text-gray-700">Total owed to drivers</p>
          <p className="text-2xl font-bold text-gray-900">KES {totalOwed.toLocaleString()}</p>
        </div>

        {state.balances.length === 0 && <p className="text-gray-700">No drivers yet.</p>}

        {state.balances.map((b) => (
          <div key={b.driver_id} className="bg-white rounded-2xl shadow p-4 space-y-2 text-gray-900">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{b.full_name || "Unnamed driver"}</p>
                <p className="text-sm text-gray-700">{b.phone || "No phone"}</p>
              </div>
              <p className={`text-lg font-bold ${b.owed > 0 ? "text-green-700" : "text-gray-700"}`}>
                KES {b.owed.toLocaleString()}
              </p>
            </div>
            <p className="text-xs text-gray-700">
              Earned KES {b.earned.toLocaleString()} · Paid out KES {b.paid_out.toLocaleString()}
            </p>

            {b.owed > 0 && openId !== b.driver_id && (
              <button onClick={() => startPayout(b)} className="w-full bg-black text-white rounded-lg p-3">
                Record payout
              </button>
            )}

            {openId === b.driver_id && (
              <div className="space-y-2 border-t pt-2">
                <p className="text-xs text-gray-700">
                  First send the money from your M-Pesa to {b.phone || "the driver"}, then record it here.
                </p>
                <input
                  type="number"
                  className="w-full border rounded-lg p-2"
                  placeholder="Amount (KES)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <input
                  className="w-full border rounded-lg p-2"
                  placeholder="M-Pesa transaction code"
                  value={ref}
                  onChange={(e) => setRef(e.target.value)}
                />
                <input
                  className="w-full border rounded-lg p-2"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {msg && <p className="text-red-600 text-sm">{msg}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => save(b)}
                    disabled={busy}
                    className="flex-1 bg-green-600 text-white rounded-lg p-3 disabled:opacity-50"
                  >
                    {busy ? "Saving..." : "Save payout"}
                  </button>
                  <button onClick={() => setOpenId(null)} className="flex-1 border rounded-lg p-3">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        <h2 className="text-lg font-bold pt-2">Recent payouts</h2>
        {state.payouts.length === 0 && <p className="text-gray-700">No payouts recorded yet.</p>}
        {state.payouts.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow p-3 text-sm text-gray-900 flex justify-between">
            <div>
              <p className="font-semibold">{p.driver?.full_name || "Driver"}</p>
              <p className="text-gray-700">
                {p.mpesa_reference} · {new Date(p.created_at).toLocaleDateString()}
                {p.note ? ` · ${p.note}` : ""}
              </p>
            </div>
            <p className="font-semibold">KES {p.amount.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </main>
  );
}