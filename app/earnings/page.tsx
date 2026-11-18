"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import { Empty, Icon, Num, PageHeader, Pill, Tile } from "@/components/AdminUI";
import { alertDialog, confirmDialog } from "@/lib/dialog";
import { friendlyError } from "@/lib/net";
import { toast } from "@/lib/toast";

type Wallet = {
  earned: number;
  pending: number;
  paid_out: number;
  requested: number;
  available: number;
  week_earned: number;
  jobs: number;
  min_payout: number;
  hold_hours: number;
  open_request: { id: string; amount: number; requested_at: string; note: string | null } | null;
};
type Item = {
  id: string;
  kind: "trip" | "cancel";
  task_type: string;
  at_time: string;
  route_km: number | null;
  price: number;
  commission: number | null;
  amount: number;
  state: "released" | "hold" | "dispute";
  release_at: string;
};
type Hist = { id: string; kind: "payout" | "request"; amount: number; status: string; ref: string | null; note: string | null; at_time: string };
type Data = { wallet: Wallet; items: Item[]; hist: Hist[]; phone: string | null };

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const STATE: Record<string, { text: string; color: string }> = {
  released: { text: "Released", color: "#059669" },
  hold: { text: "In hold", color: "#d97706" },
  dispute: { text: "Held for a report", color: "#dc2626" },
};
const REQ: Record<string, { text: string; color: string }> = {
  paid: { text: "Paid", color: "#059669" },
  requested: { text: "Requested", color: "#4338ca" },
  rejected: { text: "Not paid", color: "#dc2626" },
  cancelled: { text: "Cancelled", color: "#6b7280" },
};

async function loadAll(): Promise<Data | "login" | "other"> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return "login";
  const { data: p } = await supabase.from("profiles").select("role,phone").eq("id", u.user.id).maybeSingle();
  if (p?.role !== "driver") return "other";
  const [w, it, hi] = await Promise.all([
    supabase.rpc("my_wallet"),
    supabase.rpc("my_earning_items", { p_limit: 40 }),
    supabase.rpc("my_payout_history", { p_limit: 30 }),
  ]);
  const raw = (w.data ?? {}) as Record<string, unknown>;
  const n = (k: string) => Number(raw[k] ?? 0);
  return {
    phone: (p.phone as string | null) ?? null,
    wallet: {
      earned: n("earned"), pending: n("pending"), paid_out: n("paid_out"), requested: n("requested"),
      available: n("available"), week_earned: n("week_earned"), jobs: n("jobs"),
      min_payout: n("min_payout"), hold_hours: n("hold_hours"),
      open_request: (raw.open_request as Wallet["open_request"]) ?? null,
    },
    items: ((it.data ?? []) as Item[]).map((x) => ({ ...x, amount: Number(x.amount), price: Number(x.price) })),
    hist: ((hi.data ?? []) as Hist[]).map((x) => ({ ...x, amount: Number(x.amount) })),
  };
}

export default function EarningsPage() {
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<"earnings" | "payouts">("earnings");
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    const run = () =>
      loadAll().then((r) => {
        if (!active) return;
        if (r === "login") router.replace("/login");
        else if (r === "other") router.replace("/profile");
        else setD(r);
      });
    run();
    const t = setInterval(run, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [router, tick]);

  const request = async () => {
    if (!d || busy) return;
    const ok = await confirmDialog({
      title: `Request ${kes(d.wallet.available)}?`,
      message: `We will send it to ${d.phone} by M-Pesa on the next payout run.`,
      confirmText: "Request payout",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.rpc("request_payout");
    setBusy(false);
    if (error) {
      await alertDialog({ title: "Could not request a payout", message: friendlyError(error.message) });
      return;
    }
    toast("Payout requested", { tone: "ok" });
    setTick((t) => t + 1);
  };

  const cancelRequest = async () => {
    const ok = await confirmDialog({
      title: "Cancel this payout request?",
      message: "The money goes back to your available balance. You can request again at any time.",
      confirmText: "Cancel request",
      cancelText: "Keep it",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.rpc("cancel_payout_request");
    if (error) {
      await alertDialog({ title: "Could not cancel", message: friendlyError(error.message) });
      return;
    }
    toast("Request cancelled", { tone: "warn" });
    setTick((t) => t + 1);
  };

  if (!d) return <Loader full />;
  const w = d.wallet;
  const canRequest = !w.open_request && w.available >= w.min_payout && !!d.phone;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
        <PageHeader title="Earnings" subtitle="What you have earned and when you get paid" href="/profile" back="back" />

        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen space-y-4"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Available to withdraw</p>
              <p className="text-4xl font-extrabold tracking-tight mt-1">
                <Num value={w.available} prefix="KES " />
              </p>
            </div>
            <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <Icon name="wallet" className="w-6 h-6" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-white/80 text-xs">In hold</p>
              <p className="font-bold">{kes(w.pending)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-3">
              <p className="text-white/80 text-xs">Paid out so far</p>
              <p className="font-bold">{kes(w.paid_out)}</p>
            </div>
          </div>

          {w.open_request ? (
            <div className="rounded-2xl bg-white/15 p-3 space-y-2">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Icon name="clock" className="w-4 h-4" size={16} />
                Payout of {kes(w.open_request.amount)} requested
              </p>
              <p className="text-xs text-white/85">
                {w.open_request.note === "Weekly payout" ? "Created automatically" : "Requested"} on {when(w.open_request.requested_at)}. You will be paid by M-Pesa to {d.phone}.
              </p>
              <button onClick={cancelRequest} className="text-xs font-bold underline">
                Cancel this request
              </button>
            </div>
          ) : !d.phone ? (
            <Link href="/profile/edit" className="block text-center bg-white text-indigo-800 font-bold rounded-2xl p-3.5 active:scale-[0.98]">
              Add your M-Pesa phone number first
            </Link>
          ) : (
            <button
              onClick={request}
              disabled={!canRequest || busy}
              className="w-full flex items-center justify-center gap-2 bg-white text-indigo-800 font-bold rounded-2xl p-3.5 disabled:opacity-60 active:scale-[0.98]"
            >
              {busy ? (
                <span className="w-4 h-4 rounded-full border-2 border-indigo-200 border-t-indigo-700 animate-spin" />
              ) : (
                <Icon name="send" className="w-4 h-4" />
              )}
              {canRequest ? "Request payout" : `Minimum payout is ${kes(w.min_payout)}`}
            </button>
          )}
        </section>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: "This week", value: kes(w.week_earned), icon: "calendar", color: "#6366f1" },
            { label: "Jobs", value: String(w.jobs), icon: "car", color: "#0ea5e9" },
            { label: "Total earned", value: kes(w.earned), icon: "chart", color: "#10b981" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl shadow p-3 space-y-2">
              <div className="flex justify-center">
                <Tile name={s.icon} color={s.color} size="w-8 h-8" />
              </div>
              <p className="text-sm font-extrabold leading-tight">{s.value}</p>
              <p className="text-[11px] text-gray-700">{s.label}</p>
            </div>
          ))}
        </div>

        <section className="bg-white rounded-2xl shadow overflow-hidden">
          <button onClick={() => setHelp((h) => !h)} className="w-full flex items-center gap-3 p-4 text-left active:bg-indigo-50">
            <Tile name="info" color="#6366f1" size="w-9 h-9" />
            <span className="flex-1 font-bold">How you get paid</span>
            <span className={`text-gray-700 transition-transform ${help ? "rotate-90" : ""}`}>
              <Icon name="chevron" className="w-4 h-4" />
            </span>
          </button>
          {help && (
            <ul className="slide-in px-4 pb-4 space-y-2 text-sm">
              <li>Each completed trip adds your share to your earnings.</li>
              <li>Earnings are held for {w.hold_hours} hours, so a problem with a trip can be sorted out first. A trip with an open report stays held until it is resolved.</li>
              <li>After the hold, the money is available to withdraw. The minimum payout is {kes(w.min_payout)}.</li>
              <li>Every Monday we also create a payout request for you automatically if you have enough available.</li>
              <li>Payouts go to the M-Pesa number on your profile.</li>
            </ul>
          )}
        </section>

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-indigo-100 p-1">
          {(["earnings", "payouts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${tab === t ? "bg-white text-indigo-800 shadow" : "text-gray-700"}`}
            >
              {t === "earnings" ? "Earnings" : "Payouts"}
            </button>
          ))}
        </div>

        {tab === "earnings" ? (
          d.items.length === 0 ? (
            <Empty icon="inbox" title="No earnings yet" text="Complete a job and it will show up here." />
          ) : (
            d.items.map((i, idx) => {
              const st = STATE[i.state];
              return (
                <article key={i.id} className="slide-in bg-white rounded-2xl shadow p-4 space-y-2" style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{i.kind === "cancel" ? "Cancellation fee" : i.task_type}</p>
                      <p className="text-xs text-gray-700">
                        {when(i.at_time)}
                        {i.route_km ? `, ${i.route_km} km` : ""}
                      </p>
                    </div>
                    <p className="text-lg font-extrabold text-green-700 shrink-0">+{kes(i.amount)}</p>
                  </div>
                  {i.kind === "trip" && (
                    <p className="text-xs text-gray-700">
                      Fare {kes(i.price)}, platform fee {kes(Number(i.commission ?? 0))}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <Pill text={st.text} color={st.color} />
                    {i.state === "hold" && <span className="text-[11px] text-gray-700">Releases {when(i.release_at)}</span>}
                    <Link href={`/receipt/${i.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                      <Icon name="receipt" className="w-3.5 h-3.5" size={14} />
                      Statement
                    </Link>
                  </div>
                </article>
              );
            })
          )
        ) : d.hist.length === 0 ? (
          <Empty icon="wallet" title="No payouts yet" text="Your payout requests and payments will appear here." />
        ) : (
          d.hist.map((h) => {
            const st = REQ[h.status] ?? REQ.requested;
            return (
              <article key={`${h.kind}-${h.id}`} className="bg-white rounded-2xl shadow p-4 flex items-center gap-3">
                <Tile name={h.status === "paid" ? "check" : "send"} color={st.color} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{kes(h.amount)}</p>
                  <p className="text-xs text-gray-700 truncate">
                    {h.ref ? `M-Pesa ${h.ref}, ` : ""}
                    {when(h.at_time)}
                    {h.status === "rejected" && h.note ? `, ${h.note}` : ""}
                  </p>
                </div>
                <Pill text={st.text} color={st.color} />
              </article>
            );
          })
        )}
      </div>
    </main>
  );
}