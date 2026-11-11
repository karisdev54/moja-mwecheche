"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";
import AdminTodo from "@/components/AdminTodo";
import { Empty, Icon, Num, PageHeader, Pill, Stat, Tile } from "@/components/AdminUI";
import { toast } from "@/lib/toast";

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

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const FIELD =
  "w-full border-2 border-indigo-200 rounded-xl p-3 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

const STEPS = [
  { icon: "wallet", title: "Customers pay you", text: "The full price goes into your M-Pesa till." },
  { icon: "chart", title: "The price is split", text: "When a job is completed, you keep 15% and the driver earns 85%." },
  { icon: "user", title: "The driver's share is owed", text: "It stays owed until you send it." },
  { icon: "send", title: "You send and record it", text: "Send the money from M-Pesa, then record the code here." },
];

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`, { tone: "ok", ms: 2000 });
  } catch {
    toast("Could not copy", { tone: "warn", ms: 2000 });
  }
}

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
    .limit(30);
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
  const [help, setHelp] = useState(false);
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
    setAmount(String(Math.round(b.owed)));
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
    toast(`Payout of ${kes(value)} recorded`, { tone: "ok" });
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
  const owedDrivers = state.balances.filter((b) => b.owed > 0).length;
  const share = totalOwed + totalPaid > 0 ? totalPaid / (totalOwed + totalPaid) : 1;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <PageHeader title="Driver payouts" subtitle="Keep track of what you owe your drivers" />
        <AdminNav />
        <AdminTodo kind="payouts" />

        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">You owe drivers</p>
              <p className="text-4xl font-extrabold tracking-tight mt-1">
                <Num value={totalOwed} prefix="KES " />
              </p>
              <p className="text-sm text-white/85 mt-1">
                {owedDrivers === 0 ? "Everyone is paid up" : `Across ${owedDrivers} driver${owedDrivers === 1 ? "" : "s"}`}
              </p>
            </div>
            <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <Icon name="wallet" className="w-6 h-6" />
            </span>
          </div>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-white/25 overflow-hidden">
              <div className="h-2 rounded-full bg-white transition-[width] duration-700" style={{ width: `${Math.round(share * 100)}%` }} />
            </div>
            <p className="text-xs text-white/85 mt-1.5">{Math.round(share * 100)}% of driver earnings already paid out</p>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <Stat icon="user" color="#d97706" label="Drivers owed" value={owedDrivers} />
          <Stat icon="check" color="#059669" label="Paid out" value={totalPaid} prefix="KES " />
          <Stat icon="chart" color="#6366f1" label="Commission" value={state.commission} prefix="KES " />
        </div>

        <section className="bg-white rounded-2xl shadow overflow-hidden">
          <button onClick={() => setHelp((h) => !h)} className="w-full flex items-center gap-3 p-4 text-left active:bg-indigo-50">
            <Tile name="info" color="#6366f1" size="w-9 h-9" />
            <span className="flex-1 font-bold">How payouts work</span>
            <span className={`text-gray-700 transition-transform ${help ? "rotate-90" : ""}`}>
              <Icon name="chevron" className="w-4 h-4" />
            </span>
          </button>
          {help && (
            <div className="slide-in px-4 pb-4 space-y-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{s.title}</p>
                    <p className="text-xs text-gray-700">{s.text}</p>
                  </div>
                </div>
              ))}
              <p className="rounded-xl bg-indigo-50 p-3 text-xs">
                This page does not send money. It only keeps the record. Only completed, paid jobs are counted.
              </p>
            </div>
          )}
        </section>

        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Drivers</h2>
        {state.balances.length === 0 && <Empty icon="users" title="No drivers yet" text="Drivers will appear here once they have completed jobs." />}

        {state.balances.map((b, i) => {
          const owes = b.owed > 0;
          const color = owes ? "#d97706" : "#059669";
          const pct = b.earned > 0 ? Math.min(100, Math.round((b.paid_out / b.earned) * 100)) : 100;
          return (
            <article
              key={b.driver_id}
              className="slide-in bg-white rounded-2xl shadow overflow-hidden flex"
              style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
            >
              <div className="w-1.5 shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-base font-extrabold shrink-0">
                    {(b.full_name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold leading-tight truncate">{b.full_name || "Unnamed driver"}</h3>
                    <p className="text-xs text-gray-700 truncate">{b.phone || "No phone saved"}</p>
                  </div>
                  <Pill text={owes ? "Payment due" : "All paid"} color={color} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-indigo-50 p-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Earned</p>
                    <p className="text-sm font-extrabold">{kes(b.earned)}</p>
                  </div>
                  <div className="rounded-xl bg-indigo-50 p-2.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Paid</p>
                    <p className="text-sm font-extrabold">{kes(b.paid_out)}</p>
                  </div>
                  <div className="rounded-xl p-2.5" style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))` }}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Owed</p>
                    <p className="text-sm font-extrabold" style={{ color }}>{kes(b.owed)}</p>
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-indigo-100 overflow-hidden">
                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: "#059669" }} />
                </div>

                {owes && openId !== b.driver_id && (
                  <button
                    onClick={() => start(b)}
                    className="btn-shine grad-bg w-full flex items-center justify-center gap-2 text-white font-bold rounded-xl p-3.5 shadow-lg active:scale-[0.98]"
                  >
                    <Icon name="send" className="w-4 h-4" />
                    Record a payout
                  </button>
                )}

                {openId === b.driver_id && (
                  <div className="slide-in space-y-3 border-t border-indigo-100 pt-3">
                    <div className="rounded-xl bg-indigo-50 p-3 space-y-2 text-sm">
                      <p className="font-bold">Step 1: send the money</p>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 truncate">
                          To <b>{b.phone || "the driver"}</b>
                        </span>
                        {b.phone && (
                          <button onClick={() => copy(b.phone as string, "Phone number")} aria-label="Copy phone number" className="w-8 h-8 rounded-lg bg-white text-indigo-700 flex items-center justify-center active:scale-90">
                            <Icon name="copy" className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex-1">
                          Amount <b>{kes(b.owed)}</b>
                        </span>
                        <button onClick={() => copy(String(Math.round(b.owed)), "Amount")} aria-label="Copy amount" className="w-8 h-8 rounded-lg bg-white text-indigo-700 flex items-center justify-center active:scale-90">
                          <Icon name="copy" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm font-bold">Step 2: record it</p>
                    <input type="number" inputMode="numeric" className={FIELD} placeholder="How much did you send? (KES)" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <input className={FIELD} placeholder="M-Pesa confirmation code" value={ref} onChange={(e) => setRef(e.target.value)} />
                    <input className={FIELD} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

                    {msg && (
                      <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                        <Icon name="alert" className="w-4 h-4 mt-0.5" />
                        {msg}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => save(b)}
                        disabled={busy}
                        className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold rounded-xl p-3.5 disabled:opacity-60 active:scale-95"
                      >
                        {busy && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                        {busy ? "Saving..." : "Save record"}
                      </button>
                      <button onClick={() => setOpenId(null)} className="bg-white border-2 border-indigo-200 font-bold rounded-xl p-3.5 active:scale-95">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 pt-2">Payments you sent</h2>
        {state.payouts.length === 0 && <p className="text-sm text-gray-700">Nothing recorded yet.</p>}
        {state.payouts.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow p-3 flex items-center gap-3">
            <Tile name="wallet" color="#059669" />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{p.driver?.full_name || "Deleted account"}</p>
              <p className="text-xs text-gray-700 truncate">
                {p.mpesa_reference} · {new Date(p.created_at).toLocaleDateString()}
                {p.note ? ` · ${p.note}` : ""}
              </p>
            </div>
            <p className="font-extrabold">{kes(p.amount)}</p>
          </div>
        ))}
      </div>
    </main>
  );
}