"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/AdminUI";
import { useInbox } from "@/lib/inbox";

type Kind = "verify" | "vehicles" | "payouts" | "refunds" | "reports" | "reconcile";

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const s = (n: number) => (n === 1 ? "" : "s");

function Banner({ text, icon, urgent }: { text: string; icon: string; urgent: boolean }) {
  const [compact, setCompact] = useState(false);
  const color = urgent ? "#dc2626" : "#d97706";

  useEffect(() => {
    if (compact) return;
    const t = setTimeout(() => setCompact(true), 4000);
    return () => clearTimeout(t);
  }, [compact]);

  if (compact) {
    return (
      <button
        onClick={() => setCompact(false)}
        className="inline-flex items-center gap-2 rounded-full bg-white shadow px-3 py-1.5 text-xs font-bold active:scale-95"
        style={{ border: `2px solid ${color}`, color }}
      >
        <span className="relative flex w-2 h-2">
          <span className="live-ping absolute inline-flex w-full h-full rounded-full" style={{ background: color }} />
          <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: color }} />
        </span>
        Needs attention
      </button>
    );
  }

  return (
    <div className="slide-in flex items-center gap-3 bg-white rounded-2xl shadow p-3" style={{ borderLeft: `4px solid ${color}` }}>
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))`, color }}
      >
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <p className="flex-1 text-sm font-semibold">{text}</p>
      {urgent && (
        <span className="relative flex w-2.5 h-2.5 shrink-0">
          <span className="live-ping absolute inline-flex w-full h-full rounded-full bg-red-500" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-red-600" />
        </span>
      )}
    </div>
  );
}

export default function AdminTodo({ kind }: { kind: Kind }) {
  const i = useInbox();
  if (!i) return null;

  const n = (v: number | undefined) => v ?? 0;
  let text = "";
  let icon = "alert";
  let urgent = false;

  if (kind === "verify" && n(i.drivers_pending) > 0) {
    icon = "verify";
    text = `${n(i.drivers_pending)} driver${s(n(i.drivers_pending))} waiting for verification. Check the documents below.`;
  }
  if (kind === "vehicles" && n(i.cars_pending) > 0) {
    icon = "car";
    text = `${n(i.cars_pending)} vehicle${s(n(i.cars_pending))} waiting for approval. Check the documents below.`;
  }
  if (kind === "payouts" && n(i.payout_requests) > 0) {
    icon = "send";
    text = `${n(i.payout_requests)} payout request${s(n(i.payout_requests))} waiting, ${kes(n(i.payout_requests_amount))}. Pay them below.`;
  }
  if (kind === "refunds" && n(i.refunds_count) > 0) {
    icon = "refund";
    text = `${n(i.refunds_count)} refund${s(n(i.refunds_count))} to send, ${kes(n(i.refunds_amount))}. Send it, then record it below.`;
  }
  if (kind === "reports" && n(i.reports_open) > 0) {
    urgent = n(i.reports_safety) > 0;
    icon = urgent ? "alert" : "flag";
    text = urgent
      ? `${n(i.reports_safety)} safety report${s(n(i.reports_safety))} need you now.`
      : `${n(i.reports_open)} open report${s(n(i.reports_open))} waiting for you.`;
  }
  if (kind === "reconcile" && n(i.recon_issues) > 0) {
    icon = "alert";
    text = `${n(i.recon_issues)} item${s(n(i.recon_issues))} need a look. Review them below.`;
  }

  if (!text) return null;
  // A new message pops up again
  return <Banner key={text} text={text} icon={icon} urgent={urgent} />;
}