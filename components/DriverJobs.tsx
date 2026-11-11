"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtMinutes, getRoute, type LngLat, type RouteView } from "@/lib/mapbox";
import Guidance from "@/components/Guidance";
import PlateBadge from "@/components/PlateBadge";
import { alertDialog, confirmDialog, promptDialog } from "@/lib/dialog";
import { Icon, PersonRow, Tile } from "@/components/AdminUI";
import JobTracker from "@/components/JobTracker";

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

const JOB_STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: "New request", color: "#d97706" },
  accepted: { label: "Accepted", color: "#2563eb" },
  in_progress: { label: "In progress", color: "#7c3aed" },
};

function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {text}
    </span>
  );
}

function Info({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 p-2.5 text-sm">
      <span className="text-indigo-700 mt-0.5">
        <Icon name={icon} className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
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
        if (error) await alertDialog({ title: "Could not accept", message: error.message });
    else if (!data || data.length === 0)
      await alertDialog({ title: "Job already taken", message: "Sorry, another driver took this job." });
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
      await alertDialog({ title: "Could not update the job", message: error.message });
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
  const laterQ = online ? open.filter((j) => j.timing === "later") : [];

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

    const tabs: { v: Tab; label: string; icon: string; n: number }[] = [
    { v: "now", label: "Now", icon: "bolt", n: nowQ.length },
    { v: "later", label: "Later", icon: "calendar", n: laterQ.length },
    { v: "mine", label: "My jobs", icon: "car", n: mine.length },
  ];

    const empty =
    tab === "mine"
      ? "You have no accepted jobs yet."
      : !online
        ? "You are offline. Tap Go online to see new jobs."
        : tab === "now"
          ? "No requests within 10 km right now. Stay online and new ones will appear here."
          : hasCar === false
            ? "No scheduled bookings near you yet. Bookings that need a driver's car are hidden because you have no car."
            : "No scheduled bookings near you yet. New ones will appear here.";

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

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-indigo-100 p-1">
        {tabs.map((t) => {
          const on = tab === t.v;
          return (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                on ? "bg-white text-indigo-800 shadow" : "text-gray-700"
              }`}
            >
              <Icon name={t.icon} className="w-4 h-4" />
              {t.label}
              {t.n > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
                  {t.n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-white border border-indigo-100 p-4 text-sm">
          <Tile name="inbox" color="#6366f1" size="w-10 h-10" />
          <p className="flex-1 text-gray-800">{empty}</p>
        </div>
      )}

      {list.map((j) => {
        const t = targetFor(j);
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${t.coords[1]},${t.coords[0]}&travelmode=driving`;
        const guiding = guideId === j.id;
        const startAt = new Date(j.scheduled_at).getTime();
        const canStart = now > 0 && now >= startAt - EARLY_MS;
        const st = JOB_STATUS[j.status] ?? { label: j.status, color: "#6b7280" };
        const live = j.status === "accepted" || j.status === "in_progress";

        return (
          <article key={j.id} className="slide-in bg-white rounded-2xl shadow overflow-hidden flex">
            <div className="w-1.5 shrink-0" style={{ background: st.color }} />
            <div className="flex-1 min-w-0 p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold leading-tight">{j.task_type}</h3>
                  <p className="text-xs text-gray-700 mt-1 flex items-center gap-1.5 flex-wrap">
                    <Icon name={j.timing === "now" ? "bolt" : "calendar"} className="w-3.5 h-3.5" />
                    {j.timing === "now" ? "Immediate" : "Scheduled"}
                    <span aria-hidden="true">·</span>
                    {new Date(j.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    <span aria-hidden="true">·</span>
                    {j.duration_hours} h
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-lg font-extrabold leading-tight">KES {Number(j.price).toLocaleString()}</p>
                  <Pill text={st.label} color={st.color} />
                </div>
              </div>

              {j.status !== "requested" && <JobTracker status={j.status} paid={j.paid} />}

              <div className="space-y-2">
                <Info icon={j.vehicle === "customer_car" ? "key" : "car"}>
                  {j.vehicle === "customer_car" ? "You drive the customer's car" : "You bring the car"}
                </Info>
                {j.destination && (
                  <Info icon="pin">
                    <span className="font-semibold">{j.destination}</span>
                    {(j.route_km || j.route_min) && (
                      <span className="block text-xs text-gray-700">
                        {j.route_km ? `${j.route_km} km` : ""}
                        {j.route_km && j.route_min ? " · " : ""}
                        {j.route_min ? `about ${fmtMinutes(j.route_min)}` : ""}
                      </span>
                    )}
                  </Info>
                )}
                {j.driver_note && (
                  <Info icon="edit">
                    <span className="italic">“{j.driver_note}”</span>
                  </Info>
                )}
              </div>

              {live && j.customer && (
                <PersonRow role="Customer" name={j.customer.full_name} phone={j.customer.phone}>
                  {j.vehicle === "customer_car" && j.customer.car_plate && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <PlateBadge plate={j.customer.car_plate} small />
                      {j.customer.car_details && <span className="text-xs text-gray-700">{j.customer.car_details}</span>}
                    </div>
                  )}
                </PersonRow>
              )}

              {shown?.jobId === j.id && (
                <p className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                  <Icon name="pin" className="w-4 h-4" />
                  {shown.label}: {shown.km} km, {fmtMinutes(shown.minutes)} from you
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => showRoute(j)}
                  disabled={busyId === j.id || guiding}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border-2 border-indigo-200 bg-white p-2.5 text-sm font-bold disabled:opacity-50 active:scale-95 ${
                    j.status === "requested" ? "col-span-2" : ""
                  }`}
                >
                  <Icon name="pin" className="w-4 h-4" />
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
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-white p-2.5 text-sm font-bold active:scale-95"
                  >
                    <Icon name="locate" className="w-4 h-4" />
                    Navigate
                  </a>
                )}
              </div>

              {j.status !== "requested" && (
                <button
                  onClick={() => toggleGuide(j.id)}
                  className={`w-full flex items-center justify-center gap-2 font-bold rounded-xl p-3 active:scale-[0.98] ${
                    guiding ? "bg-white border-2 border-red-300 text-red-700" : "btn-shine grad-bg text-white shadow-lg"
                  }`}
                >
                  <Icon name={guiding ? "close" : "trend"} className="w-4 h-4" />
                  {guiding ? "Stop guidance" : "Guide me"}
                </button>
              )}

              {shown?.jobId === j.id && (
                <button onClick={clearRoute} className="text-xs font-bold underline">
                  Clear route
                </button>
              )}
              {routeMsg && busyId === null && shown?.jobId !== j.id && (
                <p className="text-xs text-red-600 font-semibold">{routeMsg}</p>
              )}

              {j.status === "requested" ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => accept(j.id)}
                    className="flex items-center justify-center gap-2 bg-green-600 text-white font-bold rounded-xl p-3 active:scale-95"
                  >
                    <Icon name="check" className="w-4 h-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => setDeclined([...declined, j.id])}
                    className="bg-white border-2 border-indigo-200 font-bold rounded-xl p-3 active:scale-95"
                  >
                    Decline
                  </button>
                </div>
              ) : j.status === "accepted" && !j.paid ? (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 text-amber-900 text-sm font-semibold p-3">
                  <Icon name="clock" className="w-4 h-4 mt-0.5" />
                  Waiting for the customer to pay. You can start once payment is received and the booked time is near.
                </p>
              ) : j.status === "accepted" && !canStart ? (
                <button disabled className="w-full btn-shine grad-bg text-white font-bold rounded-xl p-3.5 opacity-50">
                  {now === 0 ? "Checking time..." : `Starts in ${inText(startAt - EARLY_MS - now)}`}
                </button>
              ) : (
                NEXT[j.status] && (
                  <button
                    onClick={() => advance(j.id, NEXT[j.status].status)}
                    className="btn-shine grad-bg w-full text-white font-bold rounded-xl p-3.5 shadow-lg active:scale-[0.98]"
                  >
                    {NEXT[j.status].label}
                  </button>
                )
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}