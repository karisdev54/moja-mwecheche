"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DriverToggle from "@/components/DriverToggle";
import DriverJobs from "@/components/DriverJobs";
import Sheet from "@/components/Sheet";
import { Skeleton } from "@/components/Loader";
import { Icon } from "@/components/AdminUI";
import type { RouteView } from "@/lib/mapbox";

type DriverRow = {
  is_verified: boolean;
  verification_status: "unsubmitted" | "pending" | "approved" | "rejected";
  rejection_reason: string | null;
};

async function fetchDriver(driverId: string): Promise<DriverRow | null> {
  const { data } = await supabase
    .from("drivers")
    .select("is_verified,verification_status,rejection_reason")
    .eq("id", driverId)
    .maybeSingle();
  return data as DriverRow | null;
}

function Steps({ step, color }: { step: number; color: string }) {
  const labels = ["Upload", "Review", "Approved"];
  return (
    <div className="flex items-start">
      {labels.map((l, i) => (
        <div key={l} className="flex items-start flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className="relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: i <= step ? color : "#94a3b8" }}
            >
              {i === step && (
                <span className="live-ping absolute inset-0 rounded-full" style={{ background: color, opacity: 0.4 }} />
              )}
              <span className="relative flex items-center justify-center">
                {i < step ? <Icon name="tick" className="w-4 h-4" /> : i + 1}
              </span>
            </span>
            <span className="text-[10px] font-bold" style={{ color: i <= step ? color : undefined }}>
              {l}
            </span>
          </div>
          {i < labels.length - 1 && (
            <span
              className="flex-1 h-0.5 mx-1.5 mt-3.5 rounded-full"
              style={{ background: i < step ? color : "#94a3b8", opacity: i < step ? 1 : 0.5 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function DriverGate({
  driverId,
  onRouteChange,
}: {
  driverId: string;
  onRouteChange?: (r: RouteView | null) => void;
}) {
  const [info, setInfo] = useState<DriverRow | null>(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let active = true;

    fetchDriver(driverId).then((d) => {
      if (active) setInfo(d);
    });

    const channel = supabase
      .channel("my-driver-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers", filter: `id=eq.${driverId}` },
        (payload: { new: Partial<DriverRow> }) => {
          const n = payload.new;
          if (active && n.verification_status) {
            setInfo({
              is_verified: !!n.is_verified,
              verification_status: n.verification_status,
              rejection_reason: n.rejection_reason ?? null,
            });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  if (!info) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-4 space-y-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (info.is_verified) {
    return (
      <>
        <div className="flex justify-center">
          <DriverToggle driverId={driverId} onOnlineChange={setOnline} />
        </div>
        <Sheet title="My jobs">
          <DriverJobs driverId={driverId} online={online} onRouteChange={onRouteChange} />
        </Sheet>
      </>
    );
  }

  const pending = info.verification_status === "pending";
  const rejected = info.verification_status === "rejected";
  const color = pending ? "#4338ca" : rejected ? "#dc2626" : "#d97706";
  const title = pending ? "Documents under review" : rejected ? "Please upload again" : "Verify your account";
  const text = pending
    ? "We are checking your documents. This screen updates by itself when you are approved."
    : rejected
      ? "Your last documents were not accepted. Upload clear photos to try again."
      : "Upload your ID and driving licence to start accepting jobs. It takes about two minutes.";

  return (
    <div className="slide-in relative overflow-hidden rounded-3xl bg-white shadow-xl text-gray-900">
      <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${color}, #0e7490)` }} />
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <span
            className="relative w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))`, color }}
          >
            {pending && <span className="live-ping absolute inset-0 rounded-2xl" style={{ background: color, opacity: 0.25 }} />}
            <span className="relative">
              <Icon name={pending ? "clock" : rejected ? "alert" : "upload"} className="w-5 h-5" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold leading-tight">{title}</h2>
            <p className="text-sm text-gray-700 mt-1">{text}</p>
          </div>
        </div>

        {rejected && info.rejection_reason && (
          <div
            className="flex items-start gap-2.5 rounded-xl p-3 text-sm font-semibold"
            style={{ background: "color-mix(in srgb, #dc2626 10%, var(--surface))", color: "#dc2626" }}
          >
            <Icon name="info" className="w-4 h-4 mt-0.5" />
            <span>{info.rejection_reason}</span>
          </div>
        )}

        <Steps step={pending ? 1 : 0} color={color} />

        {pending ? (
          <>
            <div className="indeterminate h-1.5 rounded-full bg-indigo-100" />
            <Link href="/driver/verify" className="block text-center text-sm font-bold text-indigo-700">
              See what you submitted
            </Link>
          </>
        ) : (
          <Link
            href="/driver/verify"
            className="btn-shine grad-bg flex items-center justify-center gap-2 w-full text-white font-bold rounded-2xl p-3.5 shadow-lg active:scale-[0.98]"
          >
            <Icon name="upload" className="w-5 h-5" />
            {rejected ? "Upload again" : "Upload documents"}
          </Link>
        )}
      </div>
    </div>
  );
}