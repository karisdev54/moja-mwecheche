"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DriverToggle from "@/components/DriverToggle";
import DriverJobs from "@/components/DriverJobs";
import Sheet from "@/components/Sheet";
import { Skeleton } from "@/components/Loader";
import { Icon, Tile } from "@/components/AdminUI";
import type { RouteView } from "@/lib/mapbox";

type DriverRow = {
  is_verified: boolean;
  verification_status: "unsubmitted" | "pending" | "approved" | "rejected";
  rejection_reason: string | null;
};
type CarRow = { has_car: boolean | null; car_status: string; car_rejection_reason: string | null };

async function fetchDriver(id: string): Promise<DriverRow | null> {
  const { data } = await supabase
    .from("drivers")
    .select("is_verified,verification_status,rejection_reason")
    .eq("id", id)
    .maybeSingle();
  return data as DriverRow | null;
}

async function fetchCar(id: string): Promise<CarRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("has_car,car_status,car_rejection_reason")
    .eq("id", id)
    .maybeSingle();
  return data as CarRow | null;
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
              {i === step && <span className="live-ping absolute inset-0 rounded-full" style={{ background: color, opacity: 0.4 }} />}
              <span className="relative flex items-center justify-center">
                {i < step ? <Icon name="tick" className="w-4 h-4" /> : i + 1}
              </span>
            </span>
            <span className="text-[10px] font-bold" style={{ color: i <= step ? color : undefined }}>
              {l}
            </span>
          </div>
          {i < labels.length - 1 && (
            <span className="flex-1 h-0.5 mx-1.5 mt-3.5 rounded-full" style={{ background: i < step ? color : "#94a3b8", opacity: i < step ? 1 : 0.5 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function VehicleBanner({ car }: { car: CarRow }) {
  if (car.has_car !== true || car.car_status === "approved") return null;
  const s = car.car_status;
  const pending = s === "pending";
  const bad = s === "rejected" || s === "expired";
  const color = pending ? "#4338ca" : bad ? "#dc2626" : "#d97706";
  const title = pending ? "Vehicle under review" : s === "expired" ? "A vehicle document expired" : s === "rejected" ? "Vehicle not accepted" : "Verify your vehicle";
  const text = pending
    ? "We are checking your documents. Jobs where you bring the car open up once you are approved."
    : bad
      ? car.car_rejection_reason || "Upload the documents again and submit."
      : "Add your insurance, NTSA inspection report, logbook, plate photo and PSV badge to take jobs where you bring the car.";

  return (
    <Link
      href="/profile/car"
      className="slide-in flex items-center gap-3 rounded-2xl bg-white shadow p-3 text-gray-900 active:scale-[0.98]"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <Tile name={pending ? "clock" : bad ? "alert" : "car"} color={color} size="w-10 h-10" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight">{title}</p>
        <p className="text-xs text-gray-700">{text}</p>
      </div>
      <Icon name="chevron" className="w-4 h-4 text-gray-700" />
    </Link>
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
  const [car, setCar] = useState<CarRow | null>(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetchDriver(driverId).then((d) => active && setInfo(d));
      fetchCar(driverId).then((c) => active && setCar(c));
    };
    refresh();

    const channel = supabase
      .channel("my-driver-status")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drivers", filter: `id=eq.${driverId}` }, refresh)
      .subscribe();

    const timer = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
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
        {car && <VehicleBanner car={car} />}
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
    ? "Documents take approximately 48 hours to review. You will be verified once they are approved, and this screen updates by itself."
    : rejected
      ? "Your last documents were not accepted. Upload clear photos to try again."
      : "Upload your ID and driving licence to start accepting jobs. Review takes approximately 48 hours.";

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
          <div className="flex items-start gap-2.5 rounded-xl p-3 text-sm font-semibold" style={{ background: "color-mix(in srgb, #dc2626 10%, var(--surface))", color: "#dc2626" }}>
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