"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtMinutes, getRoute, type LngLat, type RouteView } from "@/lib/mapbox";
import Guidance from "@/components/Guidance";
import PlateBadge from "@/components/PlateBadge";

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
  vehicle: string;
  driver_note: string | null;
  timing: string;
  customer: { full_name: string | null; phone: string | null; car_plate: string | null; car_details: string | null } | null;
};

type Tab = "now" | "later" | "mine";

const EARLY_MS = 30 * 60 * 1000; // a job can be started 30 minutes before its booked time

const NEXT: Record<string, { status: string; label: string }> = {
  accepted: { status: "in_progress", label: "Start job" },
  in_progress: { status: "completed", label: "Complete job" },
};

async function fetchOpenJobs(): Promise<Job[]> {
  const { data } = await supabase
    .from("bookings")
    .select(
      "id,driver_id,task_type,scheduled_at,duration_hours,destination,price,status,paid,pickup_lat,pickup_lng,dest_lat,dest_lng,route_km,route_min,vehicle,driver_note,timing,customer:customer_id(full_name,phone,car_plate,car_details)"
    )
    .in("status", ["requested", "accepted", "in_progress"])
    .order("scheduled_at", { ascending: true });
  return (data ?? []) as unknown as Job[];
}

function targetFor(j: Job): { coords: LngLat; label: string } {
  if (j.status === "in_progress" && j.dest_lat !== null && j.dest_lng !== null) {
    return { coords: [j.dest_lng, j.dest_lat], label: "To destination" };
  }
  return { coords: [j.pickup_lng, j.pickup_lat], label: "To pickup" };
}

function inText(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
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
  const [tab, setTab] = useState<Tab>("now");
  const [now, setNow] = useState(0);
  const [hasCar, setHasCar] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [routeMsg, setRouteMsg] = useState("");
  const [shown, setShown] = useState<{ jobId: string; label: string; km: number; minutes: number } | null>(null);
  const [guideId, setGuideId] = useState<string | null>(null);

  const reload = () => {
    fetchOpenJobs().then(setJobs);
  };

  // A clock for "starts in" texts
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0);
    const t = setInterval(tick, 30000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  // Always-on refresh: bookings changing, the driver's own row changing, and a timer
  useEffect(() => {
    let active = true;

    const refresh = () => {
      fetchOpenJobs().then((j) => {
        if (active) setJobs(j);
      });
    };

    refresh();
    supabase
      .from("profiles")
      .select("has_car")
      .eq("id", driverId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setHasCar(data?.has_car ?? null);
      });

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

  // Refresh when the driver goes online or offline, and again once their first location is saved
  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetchOpenJobs().then((j) => {
        if (active) setJobs(j);
      });
    };
    const timers = [setTimeout(refresh, 0)];
    if (online) timers.push(setTimeout(refresh, 3000), setTimeout(refresh, 8000));
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
    const { data, error } = await supabase
      .from("bookings")
      .update({ driver_id: driverId, status: "accepted" })
      .eq("id", id)
      .eq("status", "requested")
      .is("driver_id", null)
      .select();
    if (error) alert(error.message);
    else if (!data || data.length === 0) alert("Sorry, another driver took this job.");
    else setTab("mine");
    reload();
  };

  const advance = async (id: string, status: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .eq("driver_id", driverId);

    if (error) {
      alert(error.message);
      reload();
      return;
    }

    if (status === "completed") {
      clearRoute();
      setGuideId(null);
    }
    if (status === "in_progress") {
      const j = jobs.find((x) => x.id === id);
      clearRoute();
      setGuideId(j && j.dest_lat !== null && j.dest_lng !== null ? id : null);
    }
    reload();
  };

  const toggleGuide = (id: string) => {
    clearRoute();
    setGuideId((cur) => (cur === id ? null : id));
  };

  // The three queues
  const mine = jobs
    .filter((j) => j.driver_id === driverId)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const open = jobs.filter((j) => j.status === "requested" && j.driver_id === null && !declined.includes(j.id));
  const nowQ = online ? open.filter((j) => j.timing === "now") : [];
  const laterQ = open.filter((j) => j.timing === "later");

  const list = tab === "now" ? nowQ : tab === "later" ? laterQ : mine;

  const guideJob = guideId
    ? jobs.find(
        (j) =>
          j.id === guideId &&
          j.driver_id === driverId &&
          (j.status === "accepted" || j.status === "in_progress")
      )
    : undefined;
  const guideTarget = guideJob ? targetFor(guideJob) : null;

  const tabs: { v: Tab; label: string; n: number }[] = [
    { v: "now", label: "⚡ Now", n: nowQ.length },
    { v: "later", label: "📅 Later", n: laterQ.length },
    { v: "mine", label: "My jobs", n: mine.length },
  ];

  const empty =
    tab === "now"
      ? online
        ? "No requests within 10 km right now. Stay online and new ones will appear here."
        : "You are offline. Tap Go online to receive Now requests."
      : tab === "later"
        ? hasCar === false
          ? "No scheduled bookings near you yet. Bookings that need a driver's car are hidden because you have no car."
          : "No scheduled bookings near you yet. New ones will appear here, even when you are offline."
        : "You have no accepted jobs yet.";

  return (
    <div className="space-y-3">
      {guideJob && guideTarget && (
        <Guidance
          toLng={guideTarget.coords[0]}
          toLat={guideTarget.coords[1]}
          label={guideTarget.label}
          onRoute={onRouteChange}
          onStop={() => setGuideId(null)}
        />
      )}

      <div className="grid grid-cols-3 gap-2">
        {tabs.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`rounded-lg border-2 p-2 text-sm font-semibold ${
              tab === t.v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
            }`}
          >
            {t.label}
            {t.n > 0 && (
              <span className="ml-1 inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                {t.n}
              </span>
            )}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 text-sm text-gray-900">{empty}</div>
      )}

      {list.map((j) => {
        const t = targetFor(j);
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${t.coords[1]},${t.coords[0]}&travelmode=driving`;
        const guiding = guideId === j.id;
        const startAt = new Date(j.scheduled_at).getTime();
        const canStart = now > 0 && now >= startAt - EARLY_MS;

        return (
          <div key={j.id} className="border-2 border-indigo-200 bg-indigo-50 rounded-xl p-3 text-sm text-gray-900">
            <div className="flex justify-between">
              <span className="font-bold">{j.task_type}</span>
              <span className="font-bold text-indigo-800">KES {j.price}</span>
            </div>
            <p className="text-gray-700">
              <span className="font-semibold">{j.timing === "now" ? "⚡ Now" : "📅 Later"}</span> ·{" "}
              {new Date(j.scheduled_at).toLocaleString()} · {j.duration_hours}h
            </p>
            <p className="text-xs">
              {j.vehicle === "customer_car" ? "🔑 Drive the customer's car" : "🚕 You bring the car"}
            </p>
            {j.driver_note && <p className="text-xs italic">Note: “{j.driver_note}”</p>}

            {(j.status === "accepted" || j.status === "in_progress") && j.customer && (
              <div className="mt-2 bg-white border-2 border-indigo-200 rounded-lg p-2 text-xs space-y-1">
                <p>
                  👤 Customer: <b>{j.customer.full_name || "Customer"}</b>
                  {j.customer.phone && (
                    <a href={`tel:${j.customer.phone}`} className="ml-2 text-blue-700 underline font-semibold">
                      Call
                    </a>
                  )}
                </p>
                {j.vehicle === "customer_car" && j.customer.car_plate && (
                  <div className="flex items-center gap-2">
                    <span>🔑 Their car:</span>
                    <PlateBadge plate={j.customer.car_plate} small />
                    {j.customer.car_details && <span>{j.customer.car_details}</span>}
                  </div>
                )}
              </div>
            )}

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
                disabled={busyId === j.id || guiding}
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

            {j.status !== "requested" && (
              <button
                onClick={() => toggleGuide(j.id)}
                className={`w-full mt-2 font-bold rounded-lg p-3 ${
                  guiding ? "bg-white border-2 border-red-300 text-red-700" : "bg-indigo-600 text-white"
                }`}
              >
                {guiding ? "Stop guidance" : "🧭 Guide me"}
              </button>
            )}

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
                Waiting for the customer to pay. You can start once payment is received and the booked time is near.
              </p>
            ) : j.status === "accepted" && !canStart ? (
              <button
                disabled
                className="w-full mt-2 bg-indigo-600 text-white font-bold rounded-lg p-3 opacity-50"
              >
                {now === 0 ? "Checking time..." : `Starts in ${inText(startAt - EARLY_MS - now)}`}
              </button>
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