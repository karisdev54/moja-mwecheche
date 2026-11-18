"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";
import { Empty, Icon, Num, PageHeader, Pill, Tile } from "@/components/AdminUI";

type Sum = {
  collected: number;
  refunds_sent: number;
  payouts_sent: number;
  expected: number;
  commission: number;
  owed_to_drivers: number;
  unfinished: number;
  refunds_pending: number;
  difference: number;
  test_payments: number;
};
type Issue = { kind: string; booking_id: string | null; amount: number; detail: string; at_time: string | null };
type State = { allowed: boolean; sum: Sum | null; issues: Issue[] };

const KIND: Record<string, { label: string; icon: string; color: string }> = {
  paid_no_payment: { label: "Paid without a payment", icon: "alert", color: "#dc2626" },
  payment_no_booking: { label: "Payment not applied", icon: "alert", color: "#dc2626" },
  amount_mismatch: { label: "Amount does not match", icon: "alert", color: "#dc2626" },
  stuck_payment: { label: "Stuck payment", icon: "clock", color: "#d97706" },
  duplicate_receipt: { label: "Repeated M-Pesa code", icon: "copy", color: "#dc2626" },
  split_mismatch: { label: "Split does not add up", icon: "chart", color: "#d97706" },
  cancel_no_refund: { label: "No refund started", icon: "refund", color: "#d97706" },
};

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;

function Row({ label, value, strong = false, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 text-sm ${strong ? "font-extrabold" : ""}`}>
      <span className={strong ? "" : "text-gray-700"}>{label}</span>
      <span className="font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

async function load(): Promise<State> {
  const none: State = { allowed: false, sum: null, issues: [] };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return none;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (p?.role !== "admin") return none;
  const [s, i] = await Promise.all([supabase.rpc("admin_reconcile"), supabase.rpc("admin_reconcile_issues")]);
  const raw = (s.data ?? {}) as Record<string, number>;
  const n = (k: string) => Number(raw[k] ?? 0);
  return {
    allowed: true,
    sum: {
      collected: n("collected"), refunds_sent: n("refunds_sent"), payouts_sent: n("payouts_sent"), expected: n("expected"),
      commission: n("commission"), owed_to_drivers: n("owed_to_drivers"), unfinished: n("unfinished"),
      refunds_pending: n("refunds_pending"), difference: n("difference"), test_payments: n("test_payments"),
    },
    issues: ((i.data ?? []) as Issue[]).map((x) => ({ ...x, amount: Number(x.amount) })),
  };
}

export default function ReconcilePage() {
  const [state, setState] = useState<State | null>(null);
  const [mine, setMine] = useState("");

  useEffect(() => {
    let active = true;
    load().then((s) => active && setState(s));
    return () => {
      active = false;
    };
  }, []);

  if (!state) return <Loader full />;
  if (!state.allowed || !state.sum) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  const s = state.sum;
  const balanced = Math.abs(s.difference) < 1 && state.issues.length === 0;
  const typed = mine.trim() === "" ? null : Number(mine.replace(/,/g, ""));
  const gap = typed !== null && !Number.isNaN(typed) ? typed - s.expected : null;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <PageHeader title="Money check" subtitle="Does the money add up?" />
        <AdminNav />

        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen space-y-3"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Should be in your M-Pesa account</p>
              <p className="text-4xl font-extrabold tracking-tight mt-1">
                <Num value={s.expected} prefix="KES " />
              </p>
            </div>
            <Pill text={balanced ? "Balanced" : "Check needed"} color={balanced ? "#059669" : "#dc2626"} />
          </div>
          <p className="text-xs text-white/85">Real payments only. Test-mode payments are ignored{s.test_payments > 0 ? ` (${s.test_payments} skipped)` : ""}.</p>
        </section>

        <section className="bg-white rounded-2xl shadow p-4 space-y-3">
          <p className="font-bold">Compare with your real balance</p>
          <input
            className="w-full border-2 border-indigo-200 rounded-xl p-3 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            inputMode="numeric"
            placeholder="Type your M-Pesa balance (KES)"
            value={mine}
            onChange={(e) => setMine(e.target.value)}
          />
          {gap !== null && (
            <p
              className="slide-in flex items-start gap-2 rounded-xl p-3 text-sm font-semibold"
              style={{
                background: `color-mix(in srgb, ${Math.abs(gap) < 1 ? "#059669" : "#dc2626"} 12%, var(--surface))`,
                color: Math.abs(gap) < 1 ? "#059669" : "#dc2626",
              }}
            >
              <Icon name={Math.abs(gap) < 1 ? "check" : "alert"} className="w-4 h-4 mt-0.5" />
              {Math.abs(gap) < 1
                ? "Your account matches."
                : gap > 0
                  ? `Your account has ${kes(gap)} more than expected. Check for money that has not been recorded, such as a payment or a refund reversal.`
                  : `Your account has ${kes(-gap)} less than expected. Check for a payout or refund sent but not recorded, and M-Pesa charges.`}
            </p>
          )}
          <p className="text-xs text-gray-700">M-Pesa transaction fees are not counted here, so small differences are normal.</p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="bg-white rounded-2xl shadow p-4 divide-y divide-indigo-100">
            <p className="font-bold pb-2">Money that came in and went out</p>
            <Row label="Collected from customers" value={kes(s.collected)} />
            <Row label="Refunds sent" value={`- ${kes(s.refunds_sent)}`} />
            <Row label="Paid to drivers" value={`- ${kes(s.payouts_sent)}`} />
            <Row label="Should be in the account" value={kes(s.expected)} strong />
          </section>
          <section className="bg-white rounded-2xl shadow p-4 divide-y divide-indigo-100">
            <p className="font-bold pb-2">Whose money it is</p>
            <Row label="Your commission" value={kes(s.commission)} color="#4338ca" />
            <Row label="Owed to drivers" value={kes(s.owed_to_drivers)} />
            <Row label="Jobs not finished yet" value={kes(s.unfinished)} />
            <Row label="Refunds waiting" value={kes(s.refunds_pending)} />
          </section>
        </div>

        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Things to check ({state.issues.length})</h2>
        {state.issues.length === 0 && <Empty icon="check" title="Nothing to check" text="Every payment, split and refund lines up." />}

        {state.issues.map((x, i) => {
          const k = KIND[x.kind] ?? { label: x.kind, icon: "alert", color: "#6b7280" };
          return (
            <article key={`${x.kind}-${x.booking_id}-${i}`} className="slide-in bg-white rounded-2xl shadow p-4 flex items-start gap-3" style={{ borderLeft: `4px solid ${k.color}`, animationDelay: `${Math.min(i, 8) * 30}ms` }}>
              <Tile name={k.icon} color={k.color} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{k.label}</p>
                  <p className="text-sm font-extrabold">{kes(x.amount)}</p>
                </div>
                <p className="text-sm text-gray-800">{x.detail}</p>
                <p className="text-xs text-gray-700">
                  {x.booking_id ? `Booking #${x.booking_id.slice(0, 8).toUpperCase()}` : ""}
                  {x.at_time ? `, ${new Date(x.at_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : ""}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}