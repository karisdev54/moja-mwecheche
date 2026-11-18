"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import Loader from "@/components/Loader";
import { Icon, PageHeader } from "@/components/AdminUI";

type R = {
  ref: string;
  role: "customer" | "driver" | "admin";
  task: string;
  status: string;
  date: string;
  paid_at: string | null;
  km: number | null;
  rate: number | null;
  price: number;
  destination: string | null;
  customer: string | null;
  driver: string | null;
  plate: string | null;
  mpesa: string | null;
  cancel_fee: number;
  refund: number | null;
  commission: number | null;
  earned: number | null;
};

const kes = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

function Line({ label, value, bold = false }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2 text-sm ${bold ? "font-extrabold text-base" : ""}`}>
      <span className="text-gray-700">{label}</span>
      <span className="text-right font-semibold break-words min-w-0">{value}</span>
    </div>
  );
}

export default function ReceiptPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<R | null | "missing">(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return router.replace("/login");
      const { data } = await supabase.rpc("get_receipt", { p_booking: id });
      if (active) setR((data as R | null) ?? "missing");
    })();
    return () => {
      active = false;
    };
  }, [id, router]);

  if (r === null) return <Loader full />;
  if (r === "missing") {
    return (
      <main className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto space-y-5">
          <PageHeader title="Receipt" subtitle="Not available" href="/activity" back="Activity" />
          <p className="bg-white rounded-2xl shadow p-5 text-sm">This receipt does not exist, or the trip has not been paid yet.</p>
        </div>
      </main>
    );
  }

  const driverView = r.role !== "customer";
  const cancelled = r.status === "cancelled";

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-md mx-auto space-y-5 text-gray-900">
        <div className="no-print">
          <PageHeader title={driverView ? "Earnings statement" : "Receipt"} subtitle={`Reference #${r.ref}`} href={driverView ? "/earnings" : "/activity"} back={driverView ? "Earnings" : "Activity"} />
        </div>

        <section className="print-card bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="h-1.5 grad-bg" />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Brand />
              <span className="text-xs font-bold text-gray-700">#{r.ref}</span>
            </div>

            <div>
              <h2 className="text-xl font-extrabold tracking-tight">{cancelled ? "Cancelled trip" : r.task}</h2>
              <p className="text-xs text-gray-700">{when(r.date)}</p>
            </div>

            <div className="divide-y divide-indigo-100 border-y border-indigo-100">
              {r.destination && <Line label="Destination" value={r.destination} />}
              {!driverView && r.driver && <Line label="Driver" value={r.driver} />}
              {driverView && r.customer && <Line label="Customer" value={r.customer} />}
              {r.plate && <Line label="Car" value={r.plate} />}
              {r.km !== null && r.rate !== null && <Line label="Distance" value={`${r.km} km at ${kes(r.rate)} per km`} />}
              {r.paid_at && <Line label="Paid on" value={when(r.paid_at)} />}
              {r.mpesa && <Line label="M-Pesa code" value={r.mpesa} />}
            </div>

            <div className="divide-y divide-indigo-100">
              <Line label="Fare" value={kes(r.price)} />
              {cancelled && <Line label="Cancellation fee" value={kes(r.cancel_fee)} />}
              {cancelled && r.refund !== null && <Line label="Refunded to customer" value={kes(r.refund)} />}
              {driverView && r.commission !== null && !cancelled && <Line label="Platform fee" value={`- ${kes(r.commission)}`} />}
              {driverView && r.earned !== null ? (
                <Line label="You earned" value={kes(r.earned)} bold />
              ) : (
                <Line label={cancelled ? "Amount charged" : "Total paid"} value={kes(cancelled ? r.cancel_fee : r.price)} bold />
              )}
            </div>

            <p className="text-xs text-gray-700">Thank you for using KEY AND GO.</p>
          </div>
        </section>

        <button onClick={() => window.print()} className="no-print btn-shine grad-bg w-full flex items-center justify-center gap-2 text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98]">
          <Icon name="printer" className="w-5 h-5" />
          Print or save as PDF
        </button>
      </div>
    </main>
  );
}