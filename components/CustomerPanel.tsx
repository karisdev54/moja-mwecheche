"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PlaceSearch from "@/components/PlaceSearch";
import { fmtMinutes, getRoute, type LngLat, type Place, type RouteView } from "@/lib/mapbox";

const HOURLY_RATE = 1000; // KES per hour, keep in sync with hourly_rate in the bookings_guard SQL
const TASKS = ["Airport transfer", "Wedding / event", "Business trip", "Errand / delivery", "Other"];
const HOUR_CHIPS = [1, 2, 3, 4, 6, 8];

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-900",
  accepted: "bg-blue-100 text-blue-900",
  in_progress: "bg-violet-100 text-violet-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-gray-200 text-gray-900",
  expired: "bg-red-100 text-red-900",
};

const ACTIVE = ["requested", "accepted", "in_progress"];

type Booking = {
  id: string;
  task_type: string;
  scheduled_at: string;
  duration_hours: number;
  destination: string | null;
  price: number;
  status: string;
  refund_status: string;
  paid: boolean;
  driver_id: string | null;
  driver: { full_name: string | null; phone: string | null } | null;
  my_rating: number | null;
  driver_avg: { avg: number; count: number } | null;
  widened_at: string | null;
  route_km: number | null;
  route_min: number | null;
};

async function fetchMyBookings(userId: string): Promise<Booking[]> {
  const { data } = await supabase
    .from("bookings")
    .select(
      "id,task_type,scheduled_at,duration_hours,destination,price,status,paid,driver_id,refund_status,widened_at,route_km,route_min,driver:driver_id(full_name,phone)"
    )
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);

  const rows = (data ?? []) as unknown as Omit<Booking, "my_rating" | "driver_avg">[];

  let mine: { booking_id: string; rating: number }[] = [];
  if (rows.length > 0) {
    const { data: r } = await supabase
      .from("reviews")
      .select("booking_id,rating")
      .in("booking_id", rows.map((x) => x.id));
    mine = (r ?? []) as { booking_id: string; rating: number }[];
  }

  const driverIds = [...new Set(rows.map((x) => x.driver_id).filter((x): x is string => !!x))];
  let stats: { driver_id: string; avg_rating: number; rating_count: number }[] = [];
  if (driverIds.length > 0) {
    const { data: s } = await supabase
      .from("driver_ratings")
      .select("driver_id,avg_rating,rating_count")
      .in("driver_id", driverIds);
    stats = (s ?? []) as typeof stats;
  }

  return rows.map((b) => {
    const st = stats.find((x) => x.driver_id === b.driver_id);
    return {
      ...b,
      my_rating: mine.find((m) => m.booking_id === b.id)?.rating ?? null,
      driver_avg: st ? { avg: Number(st.avg_rating), count: st.rating_count } : null,
    };
  });
}

export default function CustomerPanel({
  userId,
  onAssignedChange,
  onRouteChange,
}: {
  userId: string;
  onAssignedChange?: (id: string | null) => void;
  onRouteChange?: (r: RouteView | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState(TASKS[0]);
  const [when, setWhen] = useState("");
  const [hoursText, setHoursText] = useState("1");
  const [destination, setDestination] = useState("");
  const [destCoords, setDestCoords] = useState<LngLat | null>(null);
  const [myPos, setMyPos] = useState<LngLat | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ km: number; minutes: number } | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeMsg, setRouteMsg] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [msg, setMsg] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState("");
  const [nearby, setNearby] = useState<number | null>(null);

  const hoursNum = Number(hoursText);
  const hoursValid = hoursText.trim() !== "" && hoursNum >= 0.5 && hoursNum <= 72;
  const estimate = hoursValid ? Math.round(hoursNum * HOURLY_RATE) : 0;

  const cbRef = useRef(onAssignedChange);
  useEffect(() => {
    cbRef.current = onAssignedChange;
  });

  const apply = useCallback((b: Booking[]) => {
    setBookings(b);
    const active = b.find(
      (x) => x.driver_id && (x.status === "accepted" || x.status === "in_progress")
    );
    cbRef.current?.(active?.driver_id ?? null);
  }, []);

  const reload = () => {
    fetchMyBookings(userId).then(apply);
  };

  useEffect(() => {
    let active = true;

    const refresh = () => {
      fetchMyBookings(userId).then((b) => {
        if (active) apply(b);
      });
    };

    refresh();

    const channel = supabase
      .channel("my-bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `customer_id=eq.${userId}` },
        refresh
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, apply]);

  const resetTrip = () => {
    setDestination("");
    setDestCoords(null);
    setRouteInfo(null);
    setRouteMsg("");
    onRouteChange?.(null);
  };

  const openForm = () => {
    setOpen(true);
    setNearby(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setMyPos([pos.coords.longitude, pos.coords.latitude]);
        const { data } = await supabase.rpc("nearby_driver_count", {
          p_lat: pos.coords.latitude,
          p_lng: pos.coords.longitude,
        });
        setNearby(typeof data === "number" ? data : 0);
      },
      () => setNearby(null)
    );
  };

  const closeForm = () => {
    setOpen(false);
    resetTrip();
  };

  const rebook = (b: Booking) => {
    setTask(b.task_type);
    setHoursText(String(b.duration_hours));
    setWhen("");
    openForm();
  };

  // Typing a new destination clears the old route
  const onDestText = (v: string) => {
    setDestination(v);
    setRouteMsg("");
    if (destCoords) {
      setDestCoords(null);
      setRouteInfo(null);
      onRouteChange?.(null);
    }
  };

  // Picking a suggestion draws the route on the map
  const pickDestination = async (p: Place) => {
    setDestination(p.address);
    setDestCoords(p.coords);
    setRouteInfo(null);
    setRouteMsg("");
    if (!myPos) {
      setRouteMsg("Turn on location to see the route from where you are.");
      return;
    }
    setRouteBusy(true);
    const r = await getRoute(myPos, p.coords);
    setRouteBusy(false);
    if (!r) {
      setRouteMsg("Could not find a driving route to that place.");
      return;
    }
    setRouteInfo({ km: r.km, minutes: r.minutes });
    onRouteChange?.({ geometry: r.geometry, from: myPos, to: p.coords });
  };

  const submit = () => {
    setMsg("");
    if (!when) {
      setMsg("Pick a date and time");
      return;
    }
    if (!hoursValid) {
      setMsg("Enter a duration between 0.5 and 72 hours.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.from("bookings").insert({
          customer_id: userId,
          task_type: task,
          scheduled_at: new Date(when).toISOString(),
          duration_hours: hoursNum,
          pickup_lat: pos.coords.latitude,
          pickup_lng: pos.coords.longitude,
          destination: destination.trim() || null,
          dest_lat: destCoords ? destCoords[1] : null,
          dest_lng: destCoords ? destCoords[0] : null,
          route_km: routeInfo?.km ?? null,
          route_min: routeInfo?.minutes ?? null,
          price: estimate, // preview only, the database sets the real price
        });
        if (error) setMsg(error.message);
        else {
          setOpen(false);
          resetTrip();
          reload();
        }
      },
      () => setMsg("Please allow location so the driver knows where to pick you up")
    );
  };

  const cancel = async (id: string, paid: boolean) => {
    if (paid && !window.confirm("Cancel this booking and request a refund?")) return;
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    reload();
  };

  const pay = async (id: string) => {
    setPayMsg("");
    setPayingId(id);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

    try {
      const res = await fetch("/api/payments/stk", {
        method: "POST",
        headers,
        body: JSON.stringify({ bookingId: id, phone: payPhone }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setPayMsg(json.error ?? "Could not start the payment.");
        setPayingId(null);
        return;
      }
      setPayMsg(json.message ?? "Check your phone and enter your M-Pesa PIN.");

      for (let i = 0; i < 18; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const v = await fetch("/api/payments/verify", {
          method: "POST",
          headers,
          body: JSON.stringify({ bookingId: id }),
        });
        const vj = (await v.json()) as { state?: string; message?: string };

        if (vj.state === "success") {
          setPayMsg("Payment received. Thank you!");
          reload();
          setPayingId(null);
          return;
        }
        if (vj.state === "failed") {
          setPayMsg(vj.message ?? "Payment did not go through. Tap Pay to try again.");
          setPayingId(null);
          return;
        }
      }
      setPayMsg("Still waiting. If you already paid, the booking will update shortly. Otherwise tap Pay again.");
    } catch {
      setPayMsg("Network error. Please try again.");
    }
    setPayingId(null);
  };

  // TEST MODE ONLY: marks the booking paid without M-Pesa
  const testPay = async (id: string) => {
    setPayMsg("");
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/payments/test-pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token}`,
      },
      body: JSON.stringify({ bookingId: id }),
    });
    const json = (await res.json()) as { error?: string };
    setPayMsg(res.ok ? "Test payment recorded." : json.error ?? "Test payment failed.");
    reload();
  };

  // Home only shows live jobs, plus the newest expired one so "Request again" stays handy
  const newestId = bookings[0]?.id;
  const onHome = bookings.filter(
    (b) => ACTIVE.includes(b.status) || (b.status === "expired" && b.id === newestId)
  );
  const toRate = bookings.filter(
    (b) => b.status === "completed" && b.driver_id && b.my_rating === null
  ).length;

  return (
    <div className="space-y-3 text-gray-900">
      {!open ? (
        <button onClick={openForm} className="w-full bg-indigo-600 text-white font-bold rounded-xl p-4 text-lg shadow">
          🚗 Book a driver
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3">
          <div>
            <p className="text-sm font-semibold mb-1">What do you need?</p>
            <select className="w-full border-2 border-indigo-200 rounded-lg p-3" value={task} onChange={(e) => setTask(e.target.value)}>
              {TASKS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">When?</p>
            <input type="datetime-local" className="w-full border-2 border-indigo-200 rounded-lg p-3" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">How many hours?</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {HOUR_CHIPS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHoursText(String(h))}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border-2 ${
                    hoursText === String(h)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-900 border-indigo-200"
                  }`}
                >
                  {h} h
                </button>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              className="w-full border-2 border-indigo-200 rounded-lg p-3"
              placeholder="Or type your own, e.g. 2.5"
              value={hoursText}
              onChange={(e) => setHoursText(e.target.value)}
            />
            {hoursText !== "" && !hoursValid && (
              <p className="text-xs text-red-600 mt-1">Enter between 0.5 and 72 hours.</p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold mb-1">Where to? (optional)</p>
            <PlaceSearch
              value={destination}
              picked={destCoords !== null}
              near={myPos ?? undefined}
              onTextChange={onDestText}
              onPick={pickDestination}
            />
            {routeBusy && <p className="text-sm text-indigo-800 mt-1">Finding the best route...</p>}
            {routeMsg && <p className="text-sm text-red-600 mt-1">{routeMsg}</p>}
            {routeInfo && (
              <div className="mt-2 flex gap-2">
                <div className="flex-1 bg-white rounded-lg border-2 border-indigo-200 p-2 text-center">
                  <p className="text-xs text-gray-700">Distance</p>
                  <p className="font-bold">{routeInfo.km} km</p>
                </div>
                <div className="flex-1 bg-white rounded-lg border-2 border-indigo-200 p-2 text-center">
                  <p className="text-xs text-gray-700">Drive time</p>
                  <p className="font-bold">{fmtMinutes(routeInfo.minutes)}</p>
                </div>
              </div>
            )}
          </div>

          {nearby !== null && (
            <p className={`text-sm font-semibold ${nearby > 0 ? "text-green-700" : "text-red-600"}`}>
              {nearby > 0
                ? `${nearby} driver${nearby > 1 ? "s" : ""} available within 10 km`
                : "No drivers online near you right now. You can still request, and one may accept soon."}
            </p>
          )}

          <div className="bg-white rounded-lg border-2 border-indigo-200 p-3 flex justify-between items-center">
            <span className="text-sm font-semibold">Estimated price</span>
            <span className="text-xl font-bold text-indigo-800">KES {estimate.toLocaleString()}</span>
          </div>

          {msg && <p className="text-red-600 text-sm">{msg}</p>}
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 bg-indigo-600 text-white font-bold rounded-lg p-3">Request driver</button>
            <button onClick={closeForm} className="flex-1 bg-white border-2 border-indigo-200 rounded-lg p-3 font-semibold">Close</button>
          </div>
        </div>
      )}

      {toRate > 0 && (
        <Link href="/activity" className="block bg-amber-100 text-amber-900 font-semibold rounded-xl p-3 text-center">
          ⭐ Rate your driver in Activity
        </Link>
      )}

      {onHome.map((b) => (
        <div key={b.id} className="border-2 border-indigo-200 bg-indigo-50 rounded-xl p-3 text-sm text-gray-900">
          <div className="flex justify-between items-center">
            <span className="font-bold">{b.task_type}</span>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[b.status] ?? "bg-gray-200 text-gray-900"}`}>
              {b.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-gray-700 mt-1">
            {new Date(b.scheduled_at).toLocaleString()} · {b.duration_hours}h · KES {b.price}
          </p>
          {b.destination && (
            <p className="text-gray-800 mt-1">
              📍 {b.destination}
              {b.route_km ? ` · ${b.route_km} km` : ""}
              {b.route_min ? ` · about ${fmtMinutes(b.route_min)}` : ""}
            </p>
          )}

          {b.status === "requested" && (
            <p className="mt-1 font-semibold text-indigo-800">
              {b.widened_at ? "Still searching, now within 25 km..." : "Looking for a driver within 10 km..."}
            </p>
          )}
          {b.status === "expired" && (
            <div className="mt-1 space-y-1">
              <p className="font-semibold text-red-600">No driver accepted in time.</p>
              <button onClick={() => rebook(b)} className="w-full bg-indigo-600 text-white rounded-lg p-3">
                Request again
              </button>
            </div>
          )}

          {b.driver && b.status !== "cancelled" && (
            <p className="mt-1">
              Driver: <span className="font-semibold">{b.driver.full_name || "Assigned driver"}</span>
              {b.driver_avg && (
                <span className="ml-2">
                  <span className="text-yellow-500">★</span> {b.driver_avg.avg.toFixed(1)} ({b.driver_avg.count})
                </span>
              )}
              {b.driver.phone && (b.status === "accepted" || b.status === "in_progress") && (
                <a href={`tel:${b.driver.phone}`} className="ml-2 text-blue-700 underline font-semibold">
                  Call
                </a>
              )}
            </p>
          )}

          {b.paid && <p className="mt-1 text-green-700 font-semibold">Paid ✓</p>}

          {b.status === "accepted" && !b.paid && (
            <div className="mt-2 space-y-2">
              <input
                type="tel"
                className="w-full border-2 border-indigo-200 rounded-lg p-3"
                placeholder="M-Pesa number, e.g. 0712345678"
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
              />
              <button
                onClick={() => pay(b.id)}
                disabled={payingId === b.id}
                className="w-full bg-green-600 text-white font-bold rounded-lg p-3 disabled:opacity-50"
              >
                {payingId === b.id ? "Waiting for payment..." : `Pay KES ${b.price} with M-Pesa`}
              </button>
              {process.env.NEXT_PUBLIC_TEST_PAYMENTS === "true" && (
                <button
                  onClick={() => testPay(b.id)}
                  className="w-full bg-amber-500 text-black font-bold rounded-lg p-3"
                >
                  Skip payment (test mode)
                </button>
              )}
              {payMsg && <p className="text-sm font-semibold text-gray-900">{payMsg}</p>}
            </div>
          )}

          {(b.status === "requested" || b.status === "accepted") && (
            <button onClick={() => cancel(b.id, b.paid)} className="text-red-600 underline mt-2 font-semibold">
              {b.paid ? "Cancel and request refund" : "Cancel"}
            </button>
          )}
          {b.paid && b.status === "in_progress" && (
            <p className="text-xs text-gray-700 mt-1">The job has started. Contact support if there is a problem.</p>
          )}
          {b.refund_status === "needed" && (
            <p className="mt-1 text-sm font-semibold text-indigo-800">
              Refund requested. We will send your money back to M-Pesa and text you.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}