"use client";
import { useEffect, useState } from "react";
import { useInbox } from "@/lib/inbox";

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const s = (n: number) => (n === 1 ? "" : "s");

function Banner({ text, urgent }: { text: string; urgent: boolean }) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (compact) return;
    const t = setTimeout(() => setCompact(true), 4000);
    return () => clearTimeout(t);
  }, [compact]);

  if (compact) {
    return (
      <button
        onClick={() => setCompact(false)}
        className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-xs font-bold ${
          urgent ? "border-red-500 bg-red-50 text-red-800" : "border-amber-400 bg-amber-50 text-amber-900"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-red-600" />
        Needs attention
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border-2 p-3 font-semibold flex items-center gap-3 ${
        urgent ? "border-red-500 bg-red-50 text-red-800" : "border-amber-400 bg-amber-50 text-amber-900"
      }`}
    >
      <span className="relative flex w-3 h-3 shrink-0">
        <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-60 animate-ping" />
        <span className="relative inline-flex w-3 h-3 rounded-full bg-red-600" />
      </span>
      <span className="flex-1 text-sm">{text}</span>
    </div>
  );
}

export default function AdminTodo({ kind }: { kind: "verify" | "payouts" | "refunds" | "reports" }) {
  const i = useInbox();
  if (!i) return null;

  let text = "";
  let urgent = false;

  if (kind === "verify" && i.drivers_pending > 0) {
    text = `🪪 ${i.drivers_pending} driver${s(i.drivers_pending)} waiting for verification. Check the documents below.`;
  }
  if (kind === "payouts" && i.owed_drivers > 0) {
    text = `💸 You owe ${kes(i.owed_total)} to ${i.owed_drivers} driver${s(i.owed_drivers)}. Send the money, then record it below.`;
  }
  if (kind === "refunds" && i.refunds_count > 0) {
    text = `↩️ ${i.refunds_count} refund${s(i.refunds_count)} to send (${kes(i.refunds_amount)}). Send it, then record it below.`;
  }
  if (kind === "reports" && i.reports_open > 0) {
    urgent = i.reports_safety > 0;
    text = urgent
      ? `🚨 ${i.reports_safety} safety report${s(i.reports_safety)} need you now.`
      : `💬 ${i.reports_open} open report${s(i.reports_open)} waiting for you.`;
  }

  if (!text) return null;
  // A new message pops up again
  return <Banner key={text} text={text} urgent={urgent} />;
}