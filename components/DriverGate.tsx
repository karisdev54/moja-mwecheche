"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DriverToggle from "@/components/DriverToggle";
import DriverJobs from "@/components/DriverJobs";
import DriverRating from "@/components/DriverRating";
import Sheet from "@/components/Sheet";
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
    return <div className="bg-white rounded-2xl shadow p-4 text-sm text-gray-900">Loading...</div>;
  }

  if (info.is_verified) {
    return (
      <>
        <div className="flex justify-center">
          <DriverToggle driverId={driverId} onOnlineChange={setOnline} />
        </div>
        <Sheet title="My jobs">
          <DriverRating driverId={driverId} />
          <DriverJobs driverId={driverId} online={online} onRouteChange={onRouteChange} />
        </Sheet>
      </>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 space-y-3 text-gray-900">
      {info.verification_status === "pending" ? (
        <>
          <p className="font-bold text-lg">⏳ Documents under review</p>
          <p className="text-sm">We are checking your documents. You can go online as soon as you are approved, and this screen will update by itself.</p>
        </>
      ) : (
        <>
          <p className="font-bold text-lg">
            {info.verification_status === "rejected" ? "❌ Please upload again" : "👋 One last step"}
          </p>
          {info.verification_status === "rejected" && (
            <p className="text-sm text-red-600">
              Your last submission was rejected{info.rejection_reason ? `: ${info.rejection_reason}` : "."}
            </p>
          )}
          <p className="text-sm">Upload your ID and driving licence to start accepting jobs. It takes about two minutes.</p>
          <Link href="/driver/verify" className="block w-full bg-indigo-600 text-white font-bold rounded-xl p-4 text-center">
            Upload my documents
          </Link>
        </>
      )}
    </div>
  );
}