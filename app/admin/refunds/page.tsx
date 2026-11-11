"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";
import AdminTodo from "@/components/AdminTodo";
import { Empty, Icon, PageHeader, PersonRow, Pill, Stat, Tile } from "@/components/AdminUI";
import { toast } from "@/lib/toast";

type Refund = {
  id: string;
  task_type: string;
  scheduled_at: string;
  refund_amount: number | null;
  refund_status: string;
  refund_reference: string | null;
  refunded_at: string | null;
  customer: { full_name: string | null; phone: string | null } | null;
  receipt: string | null;
  pay_phone: string | null;
};
type State = { allowed: boolean; items: Refund[] };

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const FIELD =
  "w-full border-2 border-indigo-200 rounded-xl p-3 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`, { tone: "ok", ms: 2000 });
  } catch {
    toast("Could not copy", { tone: "warn", ms: 2000 });
  }
}

async function fetchRefunds(): Promise<State> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { allowed: false, items: [] };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (me?.role !== "admin") return { allowed: false, items: [] };

  const { data } = await supabase
    .from("bookings")
    .select(
      "id,task_type,scheduled_at,refund_amount,refund_status,refund_reference,refunded_at,customer:customer_id(full_name,phone)"
    )
    .in("refund_status", ["needed", "refunded"])
    .order("created_at", { ascending: false })
    .limit(60);
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

function Detail({ label, value, copyable }: { label: string; value: string | null; copyable?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 text-xs font-bold uppercase tracking-wider text-gray-700">{label}</span>
      <span className="flex-1 min-w-0 truncate font-semibold">{value || "Not recorded"}</span>
      {copyable && value && (
        <button
          onClick={() => copy(value, label)}
          aria-label={`Copy ${label}`}
          className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 active:scale-90"
        >
          <Icon name="copy" className="w-4 h-4" />
        </button>
      )}
    </div>
  );
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

  const open = (id: string) => {
    setOpenId(id);
    setRef("");
    setNote("");
    setMsg("");
  };

  const save = async (id: string) => {
    if (busy) return;
    setMsg("");
    if (ref.trim().length < 5) return setMsg("Enter the M-Pesa code of the refund you sent.");
    setBusy(true);
    const { error } = await supabase.rpc("admin_mark_refunded", { p_booking: id, p_reference: ref, p_note: note });
    setBusy(false);
    if (error) return setMsg(error.message);
    setOpenId(null);
    toast("Refund recorded. The customer was told.", { tone: "ok" });
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
  const waiting = pending.reduce((s, r) => s + Number(r.refund_amount ?? 0), 0);
  const sent = done.reduce((s, r) => s + Number(r.refund_amount ?? 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <PageHeader title="Refunds" subtitle="Send money back to customers" />
        <AdminNav />
        <AdminTodo kind="refunds" />

        <div className="grid grid-cols-3 gap-3">
          <Stat icon="refund" color="#d97706" label="To send" value={pending.length} />
          <Stat icon="wallet" color="#dc2626" label="Amount waiting" value={waiting} prefix="KES " />
          <Stat icon="check" color="#059669" label="Sent so far" value={sent} prefix="KES " />
        </div>

        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Waiting for refund</h2>
        {pending.length === 0 && <Empty icon="check" title="No refunds waiting" text="Everything has been refunded." />}

        {pending.map((r, i) => (
          <article
            key={r.id}
            className="slide-in bg-white rounded-2xl shadow overflow-hidden flex"
            style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
          >
            <div className="w-1.5 shrink-0" style={{ background: "#d97706" }} />
            <div className="flex-1 min-w-0 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Refund amount</p>
                  <p className="text-3xl font-extrabold tracking-tight">{kes(r.refund_amount ?? 0)}</p>
                </div>
                <Pill text="Waiting" color="#d97706" />
              </div>

              <p className="text-xs text-gray-700 flex items-center gap-1.5">
                <Icon name="car" className="w-3.5 h-3.5" />
                {r.task_type}
                <span aria-hidden="true">·</span>
                {new Date(r.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </p>

              <PersonRow role="Customer" name={r.customer?.full_name} phone={r.customer?.phone} empty="Deleted account" />

              <div className="rounded-xl bg-indigo-50 p-3 space-y-2">
                <Detail label="Paid from" value={r.pay_phone === "TEST" ? "Test payment" : r.pay_phone} copyable={r.pay_phone !== "TEST"} />
                <Detail label="Receipt" value={r.receipt} copyable />
              </div>

              {openId !== r.id ? (
                <button
                  onClick={() => open(r.id)}
                  className="btn-shine grad-bg w-full flex items-center justify-center gap-2 text-white font-bold rounded-xl p-3.5 shadow-lg active:scale-[0.98]"
                >
                  <Icon name="refund" className="w-4 h-4" />
                  Record refund
                </button>
              ) : (
                <div className="slide-in space-y-3 border-t border-indigo-100 pt-3">
                  <ol className="space-y-1.5 text-sm">
                    <li className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                      <span>
                        Send {kes(r.refund_amount ?? 0)} to {r.pay_phone && r.pay_phone !== "TEST" ? r.pay_phone : "the customer"} from your M-Pesa, or reverse the transaction.
                      </span>
                    </li>
                    <li className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                      <span>Enter the confirmation code below.</span>
                    </li>
                  </ol>
                  <input className={FIELD} placeholder="M-Pesa code of the refund" value={ref} onChange={(e) => setRef(e.target.value)} />
                  <input className={FIELD} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                  {msg && (
                    <p className="flex items-center gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                      <Icon name="alert" className="w-4 h-4" />
                      {msg}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => save(r.id)}
                      disabled={busy}
                      className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold rounded-xl p-3.5 disabled:opacity-60 active:scale-95"
                    >
                      {busy && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                      {busy ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setOpenId(null)} className="bg-white border-2 border-indigo-200 font-bold rounded-xl p-3.5 active:scale-95">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}

        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 pt-2">Refunded</h2>
        {done.length === 0 && <p className="text-sm text-gray-700">None yet.</p>}
        {done.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl shadow p-3 flex items-center gap-3">
            <Tile name="check" color="#059669" />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{r.customer?.full_name || "Deleted account"}</p>
              <p className="text-xs text-gray-700 truncate">
                {r.refund_reference} · {r.refunded_at ? new Date(r.refunded_at).toLocaleDateString() : r.task_type}
              </p>
            </div>
            <p className="font-extrabold">{kes(r.refund_amount ?? 0)}</p>
          </div>
        ))}
      </div>
    </main>
  );
}