"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtMinutes, getRoute, type LngLat, type RouteView } from "@/lib/mapbox";

type Job = {
  id: string;
  driver_id: string | null;
  task_type: string;
  scheduled_at: string;
  duration_hours: number;
  destination: string | null;
  price: number;
  status: string;
  paid: boolean;
  pickup_lat: number;
  pickup_lng: number;
  dest_lat: number | null;
  dest_lng: number | null;
  route_km: number | null;
  route_min: number | null;
};

const NEXT: Record<string, { status: string; label: string }> = {
  accepted: { status: "in_progress", label: "Start job" },
  in_progress: { status: "completed", label: "Complete job" },
};

async function fetchOpenJobs(): Promise<Job[]> {
  const { data } = await supabase
    .from("bookings")
    .select(
      "id,driver_id,task_type,scheduled_at,duration_hours,destination,price,status,paid,pickup_lat,pickup_lng,dest_lat,dest_lng,route_km,route_min"
    )
    .in("status", ["requested", "accepted", "in_progress"])
    .order("scheduled_at", { ascending: true });
  return (data ?? []) as Job[];
}

// Where the driver should be heading for this job right now
function targetFor(j: Job): { coords: LngLat; label: string } {
  if (j.status === "in_progress" && j.dest_lat !== null && j.dest_lng !== null) {
    return { coords: [j.dest_lng, j.dest_lat], label: "To destination" };
  }
  return { coords: [j.pickup_lng, j.pickup_lat], label: "To pickup" };
}

export default function DriverJobs({
  driverId,
  online,
  onRouteChange,
}: {
  driverId: string;
  online: boolean;
  onRouteChange?: (r: RouteView | null) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [declined, setDeclined] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [routeMsg, setRouteMsg] = useState("");
  const [shown, setShown] = useState<{ jobId: string; label: string; km: number; minutes: number } | null>(null);

  // Used only by buttons (accept, advance), never inside an effect
  const reload = () => {
    fetchOpenJobs().then(setJobs);
  };

  // Always-on refresh: bookings changing, the driver's own row changing, and a timer
  useEffect(() => {
    let active = true;

    const refresh = () => {
      fetchOpenJobs().then((j) => {
        if (active) setJobs(j);
      });
    };

    refresh();
    const timer = setInterval(refresh, 10000);

    const channel = supabase
      .channel("driver-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, refresh)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers", filter: `id=eq.${driverId}` },
        refresh
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  // Refresh when the driver goes online or offline, and again once their first
  // location has been saved (the database needs it before showing nearby requests)
  useEffect(() => {
    let active = true;

    const refresh = () => {
      fetchOpenJobs().then((j) => {
        if (active) setJobs(j);
      });
    };

    const timers = [setTimeout(refresh, 0)];
    if (online) {
      timers.push(setTimeout(refresh, 3000), setTimeout(refresh, 8000));
    }

    return () => {
      active = false;
      timers.forEach(clearTimeout);
    };
  }, [online]);

  const showRoute = (j: Job) => {
    setRouteMsg("");
    setBusyId(j.id);
    const t = targetFor(j);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const from: LngLat = [pos.coords.longitude, pos.coords.latitude];
        const r = await getRoute(from, t.coords);
        setBusyId(null);
        if (!r) {
          setRouteMsg("Could not find a route.");
          return;
        }
        setShown({ jobId: j.id, label: t.label, km: r.km, minutes: r.minutes });
        onRouteChange?.({ geometry: r.geometry, from, to: t.coords });
      },
      () => {
        setBusyId(null);
        setRouteMsg("Turn on location to see the route.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clearRoute = () => {
    setShown(null);
    onRouteChange?.(null);
  };

  const accept = async (id: string) => {
    const { data } = await supabase
      .from("bookings")
      .update({ driver_id: driverId, status: "accepted" })
      .eq("id", id)
      .eq("status", "requested")
      .is("driver_id", null)
      .select();
    if (!data || data.length === 0) alert("Sorry, another driver took this job.");
    reload();
  };

  const advance = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status }).eq("id", id).eq("driver_id", driverId);
    if (status === "completed") clearRoute();
    reload();
  };

  // New requests only show while online. The driver's own jobs always show.
  const visible = jobs.filter(
    (j) =>
      j.driver_id === driverId ||
      (online && j.status === "requested" && !declined.includes(j.id))
  );

  if (visible.length === 0) {
    return (
      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 text-sm text-gray-900">
        {online
          ? "No requests within 10 km right now. Stay online and new jobs will appear here."
          : "You are offline. Tap Go online to see job requests near you."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((j) => {
        const t = targetFor(j);
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${t.coords[1]},${t.coords[0]}&travelmode=driving`;
        return (
          <div key={j.id} className="border-2 border-indigo-200 bg-indigo-50 rounded-xl p-3 text-sm text-gray-900">
            <div className="flex justify-between">
              <span className="font-bold">{j.task_type}</span>
              <span className="font-bold text-indigo-800">KES {j.price}</span>
            </div>
            <p className="text-gray-700">
              {new Date(j.scheduled_at).toLocaleString()} · {j.duration_hours}h
            </p>
            {j.destination && (
              <p className="mt-1">
                📍 To {j.destination}
                {j.route_km ? ` · ${j.route_km} km` : ""}
                {j.route_min ? ` · about ${fmtMinutes(j.route_min)}` : ""}
              </p>
            )}

            {shown?.jobId === j.id && (
              <p className="mt-1 font-semibold text-indigo-800">
                {shown.label}: {shown.km} km · {fmtMinutes(shown.minutes)} from you
              </p>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => showRoute(j)}
                disabled={busyId === j.id}
                className="flex-1 bg-white border-2 border-indigo-300 rounded-lg p-2 font-semibold disabled:opacity-50"
              >
                {busyId === j.id
                  ? "Finding..."
                  : j.status === "requested"
                    ? "View pickup route"
                    : t.label === "To pickup"
                      ? "Route to pickup"
                      : "Route to destination"}
              </button>
              {j.status !== "requested" && (
                <a
                  href={navUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 bg-blue-600 text-white rounded-lg p-2 font-semibold text-center"
                >
                  Navigate
                </a>
              )}
            </div>
            {shown?.jobId === j.id && (
              <button onClick={clearRoute} className="text-xs underline mt-1">Clear route</button>
            )}
            {routeMsg && busyId === null && shown?.jobId !== j.id && (
              <p className="text-xs text-red-600 mt-1">{routeMsg}</p>
            )}

            {j.status === "requested" ? (
              <div className="flex gap-2 mt-2">
                <button onClick={() => accept(j.id)} className="flex-1 bg-green-600 text-white font-bold rounded-lg p-3">Accept</button>
                <button onClick={() => setDeclined([...declined, j.id])} className="flex-1 bg-white border-2 border-indigo-200 rounded-lg p-3">Decline</button>
              </div>
            ) : j.status === "accepted" && !j.paid ? (
              <p className="mt-2 text-xs text-gray-900 bg-white rounded-lg p-2 border border-indigo-200">
                Waiting for the customer to pay. You can start once payment is received.
              </p>
            ) : (
              NEXT[j.status] && (
                <button onClick={() => advance(j.id, NEXT[j.status].status)} className="w-full mt-2 bg-indigo-600 text-white font-bold rounded-lg p-3">
                  {NEXT[j.status].label}
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}