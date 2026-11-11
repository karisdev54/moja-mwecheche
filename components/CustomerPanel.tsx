"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import PlaceSearch from "@/components/PlaceSearch";
import MapPicker from "@/components/MapPicker";
import PlateBadge from "@/components/PlateBadge";
import { fmtMinutes, getRoute, type LngLat, type Place, type RouteView } from "@/lib/mapbox";
import JobTracker from "@/components/JobTracker";
import { alertDialog, confirmDialog, promptDialog } from "@/lib/dialog";
import { Icon, PersonRow } from "@/components/AdminUI";

const HOURLY_RATE = 1000; // KES per hour, keep in sync with hourly_rate in the bookings_guard SQL
const TASKS = ["Airport transfer", "Wedding / event", "Business trip", "Errand / delivery", "Other"];
const HOUR_CHIPS = [1, 2, 3, 4, 5, 6, 7, 8];

const STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: "Awaiting driver", color: "#d97706" },
  accepted: { label: "Accepted", color: "#2563eb" },
  in_progress: { label: "In progress", color: "#7c3aed" },
  completed: { label: "Completed", color: "#059669" },
  cancelled: { label: "Cancelled", color: "#6b7280" },
  expired: { label: "Expired", color: "#dc2626" },
};

const ACTIVE = ["requested", "accepted", "in_progress"];

type Vehicle = "driver_car" | "customer_car";
type Timing = "now" | "later";

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
  driver: {
    full_name: string | null;
    phone: string | null;
    car_details: string | null;
    has_car: boolean | null;
    car_plate: string | null;
    car_status: string | null;
  } | null;
  widened_at: string | null;
  route_km: number | null;
  route_min: number | null;
  vehicle: string;
  driver_note: string | null;
  timing: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Time is read here, outside the component, so rendering stays predictable
const nowMs = () => Date.now();
const nowIso = () => new Date(nowMs()).toISOString();
const minLaterInput = () => toLocalInput(new Date(nowMs() + 60 * 60 * 1000));
const isTooSoon = (iso: string) => new Date(iso).getTime() < nowMs() + 55 * 60 * 1000;

// Shows a message, then clears it
function flash(set: (v: string) => void, text: string, ms = 6000) {
  set(text);
  setTimeout(() => set(""), ms);
}

async function fetchMyBookings(userId: string): Promise<Booking[]> {
  const { data } = await supabase
    .from("bookings")
    .select(
      "id,task_type,scheduled_at,duration_hours,destination,price,status,paid,driver_id,refund_status,widened_at,route_km,route_min,vehicle,driver_note,timing,driver:driver_id(full_name,phone,car_details,has_car,car_plate,car_status)"
    )
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []) as unknown as Booking[];
}
const FIELD =
  "w-full border-2 border-indigo-200 rounded-xl p-3 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

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

function Block({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-700">
        <span className="text-indigo-600">
          <Icon name={icon} className="w-4 h-4" />
        </span>
        {title}
      </p>
      {children}
    </div>
  );
}

function Choice({
  on,
  disabled,
  onClick,
  icon,
  label,
  sub,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl border-2 p-3 text-center flex flex-col items-center gap-1 transition-all active:scale-95 disabled:opacity-40 ${
        on ? "border-indigo-600 bg-indigo-600 text-white shadow-lg" : "border-indigo-200 bg-white text-gray-900"
      }`}
    >
      <Icon name={icon} className="w-6 h-6" />
      <span className="text-sm font-bold">{label}</span>
      {sub && <span className="text-[11px] opacity-80">{sub}</span>}
    </button>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-sm font-semibold border-2 transition-colors active:scale-95 ${
        on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-900 border-indigo-200"
      }`}
    >
      {children}
    </button>
  );
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
  const [timing, setTiming] = useState<Timing>("now");
  const [when, setWhen] = useState("");
  const [minWhen, setMinWhen] = useState("");
  const [hoursText, setHoursText] = useState("1");
  const [vehicle, setVehicle] = useState<Vehicle>("driver_car");
  const [hasCar, setHasCar] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState("");
  const [destCoords, setDestCoords] = useState<LngLat | null>(null);
  const [myPos, setMyPos] = useState<LngLat | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ km: number; minutes: number } | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeMsg, setRouteMsg] = useState("");
  const [picking, setPicking] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [msg, setMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
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
    const active = b.find((x) => x.driver_id && (x.status === "accepted" || x.status === "in_progress"));
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

  // Does this customer own a car? (set when registering, changed in Profile, My car)
  useEffect(() => {
    let active = true;
    supabase
      .from("profiles")
      .select("has_car")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setHasCar(data?.has_car ?? null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const resetTrip = () => {
    setDestination("");
    setDestCoords(null);
    setRouteInfo(null);
    setRouteMsg("");
    onRouteChange?.(null);
  };

  // Empties every box
  const resetForm = () => {
    setTask(TASKS[0]);
    setTiming("now");
    setWhen("");
    setHoursText("1");
    setVehicle("driver_car");
    setNote("");
    setMsg("");
    resetTrip();
  };

  const openForm = () => {
    setOpen(true);
    setNearby(null);
    setMinWhen(minLaterInput());
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
    resetForm();
  };

  const rebook = (b: Booking) => {
    setTask(b.task_type);
    setHoursText(String(b.duration_hours));
    setTiming(b.timing === "later" ? "later" : "now");
    setWhen("");
    openForm();
  };

  const onDestText = (v: string) => {
    setDestination(v);
    setRouteMsg("");
    if (destCoords) {
      setDestCoords(null);
      setRouteInfo(null);
      onRouteChange?.(null);
    }
  };

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
    if (sendingRef.current) return; // a second tap is ignored
    setMsg("");

    if (timing === "later") {
      if (!when) return setMsg("Pick a date and time");
      if (isTooSoon(when)) {
        return setMsg("Later bookings must be at least 1 hour from now. Choose Now for an immediate request.");
      }
    }
    if (!hoursValid) return setMsg("Enter a duration between 0.5 and 72 hours.");
    if (!destCoords) return setMsg("Choose where you are going. Pick a suggestion or use the map.");

    sendingRef.current = true;
    setSending(true);
    const finish = () => {
      sendingRef.current = false;
      setSending(false);
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.from("bookings").insert({
          customer_id: userId,
          task_type: task,
          timing,
          scheduled_at: timing === "now" ? nowIso() : new Date(when).toISOString(),
          duration_hours: hoursNum,
          vehicle,
          driver_note: note.trim() || null,
          pickup_lat: pos.coords.latitude,
          pickup_lng: pos.coords.longitude,
          destination: destination.trim() || null,
          dest_lat: destCoords[1],
          dest_lng: destCoords[0],
          route_km: routeInfo?.km ?? null,
          route_min: routeInfo?.minutes ?? null,
          price: estimate, // preview only, the database sets the real price
        });
        finish();
        if (error) {
          flash(setMsg, error.message);
          return;
        }
        setOpen(false);
        resetForm();
        flash(
          setNotice,
          timing === "now" ? "Request sent ✓ Looking for a driver" : "Booking sent ✓ Drivers can accept it now"
        );
        reload();
      },
      () => {
        finish();
        flash(setMsg, "Please allow location so the driver knows where to pick you up");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

    const cancel = async (id: string, paid: boolean) => {
    const ok = await confirmDialog(
      paid
        ? {
            title: "Cancel and request a refund?",
            message: "Your driver will be told, and we will send your money back to M-Pesa.",
            confirmText: "Cancel booking",
            cancelText: "Keep booking",
            danger: true,
          }
        : { title: "Cancel this request?", confirmText: "Cancel request", cancelText: "Keep it", danger: true }
    );
    if (!ok) return;
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    reload();
  };

  // Removes an expired request completely
  const remove = async (id: string) => {
    await supabase.from("bookings").delete().eq("id", id);
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
        flash(setPayMsg, json.error ?? "Could not start the payment.");
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
          setPayPhone("");
          flash(setPayMsg, "Payment received ✓");
          reload();
          setPayingId(null);
          return;
        }
        if (vj.state === "failed") {
          flash(setPayMsg, vj.message ?? "Payment did not go through. Tap Pay to try again.");
          setPayingId(null);
          return;
        }
      }
      flash(setPayMsg, "Still waiting. If you already paid, the booking will update shortly.", 10000);
    } catch {
      flash(setPayMsg, "Network error. Please try again.");
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
    flash(setPayMsg, res.ok ? "Test payment recorded." : json.error ?? "Test payment failed.");
    reload();
  };

  // Home only shows live jobs, plus the newest expired one so "Request again" stays handy
  const newestId = bookings[0]?.id;
  const onHome = bookings.filter(
    (b) => ACTIVE.includes(b.status) || (b.status === "expired" && b.id === newestId)
  );

    return (
    <div className="space-y-4 text-gray-900">
      {notice && (
        <p className="slide-in flex items-center gap-2 rounded-2xl bg-green-50 text-green-800 text-sm font-semibold p-3">
          <Icon name="check" className="w-4 h-4" />
          {notice}
        </p>
      )}

      {!open ? (
        <button
          onClick={openForm}
          className="btn-shine grad-bg w-full text-white rounded-2xl p-4 shadow-xl active:scale-[0.98] flex items-center gap-3 text-left"
        >
          <span className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="car" className="w-6 h-6" />
          </span>
          <span className="flex-1">
            <span className="block font-bold text-base">Book a driver</span>
            <span className="block text-xs text-white/80">Now or later, with a verified driver</span>
          </span>
          <Icon name="chevron" className="w-5 h-5" />
        </button>
      ) : (
        <fieldset
          disabled={sending}
          className="min-w-0 space-y-5 rounded-2xl border border-indigo-100 bg-white p-4 shadow"
        >
          <Block icon="clock" title="When">
            <div className="grid grid-cols-2 gap-2">
              <Choice on={timing === "now"} onClick={() => setTiming("now")} icon="bolt" label="Now" sub="As soon as possible" />
              <Choice on={timing === "later"} onClick={() => setTiming("later")} icon="calendar" label="Later" sub="Pick a date and time" />
            </div>
            {timing === "later" && (
              <div className="slide-in space-y-1">
                <input
                  type="datetime-local"
                  min={minWhen}
                  className={FIELD}
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                />
                <p className="text-xs text-gray-700">
                  At least 1 hour from now. Drivers can accept ahead of time, and yours starts at the booked time.
                </p>
              </div>
            )}
          </Block>

          <Block icon="list" title="What do you need">
            <div className="flex flex-wrap gap-2">
              {TASKS.map((t) => (
                <Chip key={t} on={task === t} onClick={() => setTask(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </Block>

          <Block icon="clock" title="How long">
            <div className="flex flex-wrap gap-2">
              {HOUR_CHIPS.map((h) => (
                <Chip key={h} on={hoursText === String(h)} onClick={() => setHoursText(String(h))}>
                  {h} h
                </Chip>
              ))}
            </div>
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              className={FIELD}
              placeholder="Or type your own, e.g. 2.5"
              value={hoursText}
              onChange={(e) => setHoursText(e.target.value)}
            />
            {hoursText !== "" && !hoursValid && (
              <p className="text-xs text-red-600 font-semibold">Enter between 0.5 and 72 hours.</p>
            )}
          </Block>

          <Block icon="car" title="Which car">
            <div className="grid grid-cols-2 gap-2">
              <Choice on={vehicle === "driver_car"} onClick={() => setVehicle("driver_car")} icon="car" label="Driver's car" sub="The driver brings one" />
              <Choice
                on={vehicle === "customer_car"}
                disabled={hasCar !== true}
                onClick={() => setVehicle("customer_car")}
                icon="key"
                label="My car"
                sub="The driver drives it"
              />
            </div>
            {hasCar !== true && (
              <p className="text-xs text-gray-700">
                You have no car on your account, so My car is off. You can add one in Profile, My vehicle.
              </p>
            )}
          </Block>

          <Block icon="pin" title="Where to (required)">
            <PlaceSearch
              value={destination}
              picked={destCoords !== null}
              near={myPos ?? undefined}
              onTextChange={onDestText}
              onPick={pickDestination}
            />
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-indigo-300 font-bold rounded-xl p-3 active:scale-[0.98]"
            >
              <Icon name="pin" className="w-4 h-4" />
              Choose on the map
            </button>
            {routeBusy && <p className="text-sm text-indigo-800 font-semibold">Finding the best route...</p>}
            {routeMsg && <p className="text-sm text-red-600 font-semibold">{routeMsg}</p>}
            {routeInfo && (
              <div className="slide-in grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-indigo-50 p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Distance</p>
                  <p className="text-lg font-extrabold">{routeInfo.km} km</p>
                </div>
                <div className="rounded-xl bg-indigo-50 p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Drive time</p>
                  <p className="text-lg font-extrabold">{fmtMinutes(routeInfo.minutes)}</p>
                </div>
              </div>
            )}
          </Block>

          <Block icon="edit" title="Note for the driver (optional)">
            <textarea
              className={FIELD}
              rows={2}
              maxLength={200}
              placeholder="Gate colour, landmark, floor, car plate"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Block>

          {timing === "now" && nearby !== null && (
            <p
              className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${
                nearby > 0 ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900"
              }`}
            >
              <Icon name={nearby > 0 ? "check" : "alert"} className="w-4 h-4" />
              {nearby > 0
                ? `${nearby} driver${nearby > 1 ? "s" : ""} available within 10 km`
                : "No drivers online near you right now. You can still request, and one may accept soon."}
            </p>
          )}

          <div
            className="relative overflow-hidden rounded-2xl p-4 text-white sheen"
            style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Estimated price</p>
            <p className="text-3xl font-extrabold tracking-tight">KES {estimate.toLocaleString()}</p>
            <p className="text-xs text-white/80">
              {hoursValid
                ? `${hoursNum} hour${hoursNum === 1 ? "" : "s"} at KES ${HOURLY_RATE.toLocaleString()} per hour`
                : "Enter how many hours you need"}
            </p>
          </div>

          {msg && (
            <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
              <Icon name="alert" className="w-4 h-4 mt-0.5" />
              {msg}
            </p>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={submit}
              disabled={sending}
              className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {sending && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {sending ? "Sending request..." : "Request driver"}
            </button>
            <button type="button" onClick={closeForm} className="w-full text-sm font-bold text-gray-700 p-2">
              Cancel
            </button>
          </div>
        </fieldset>
      )}

      {onHome.map((b) => {
        const st = STATUS[b.status] ?? { label: b.status, color: "#6b7280" };
        const live = b.status === "accepted" || b.status === "in_progress";
        return (
          <article key={b.id} className="slide-in bg-white rounded-2xl shadow overflow-hidden flex">
            <div className="w-1.5 shrink-0" style={{ background: st.color }} />
            <div className="flex-1 min-w-0 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold leading-tight">{b.task_type}</h3>
                  <p className="text-xs text-gray-700 mt-1 flex items-center gap-1.5 flex-wrap">
                    <Icon name={b.timing === "now" ? "bolt" : "calendar"} className="w-3.5 h-3.5" />
                    {b.timing === "now" ? "Immediate" : "Scheduled"}
                    <span aria-hidden="true">·</span>
                    {new Date(b.scheduled_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <Pill text={st.label} color={st.color} />
              </div>

              <JobTracker status={b.status} paid={b.paid} />

              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Amount</p>
                  <p className="text-2xl font-extrabold tracking-tight">KES {Number(b.price).toLocaleString()}</p>
                </div>
                <div className="text-right space-y-1">
                  {b.paid && <Pill text="Paid" color="#059669" />}
                  <p className="text-xs text-gray-700">{b.duration_hours} h</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-800">
                <Icon name={b.vehicle === "customer_car" ? "key" : "car"} className="w-4 h-4 text-indigo-700" />
                {b.vehicle === "customer_car" ? "The driver uses your car" : "The driver brings a car"}
              </div>

              {b.destination && (
                <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 p-3">
                  <span className="text-indigo-700 mt-0.5">
                    <Icon name="pin" className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold break-words">{b.destination}</p>
                    {(b.route_km || b.route_min) && (
                      <p className="text-xs text-gray-700">
                        {b.route_km ? `${b.route_km} km` : ""}
                        {b.route_km && b.route_min ? " · " : ""}
                        {b.route_min ? `about ${fmtMinutes(b.route_min)}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {b.driver_note && <p className="text-xs italic text-gray-800">“{b.driver_note}”</p>}

              {b.status === "requested" && (
                <p className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-200 border-t-indigo-700 animate-spin" />
                  {b.timing === "later"
                    ? "Waiting for a driver to accept your booking"
                    : b.widened_at
                      ? "Still searching, now within 25 km"
                      : "Looking for a driver within 10 km"}
                </p>
              )}

              {b.status === "expired" && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-red-600">No driver accepted in time.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => rebook(b)} className="btn-shine grad-bg text-white rounded-xl p-3 text-sm font-bold">
                      Request again
                    </button>
                    <button
                      onClick={() => remove(b.id)}
                      className="bg-white border-2 border-red-300 text-red-700 rounded-xl p-3 text-sm font-bold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              {b.driver && b.status !== "cancelled" && (
                <PersonRow role="Your driver" name={b.driver.full_name} phone={live ? b.driver.phone : null}>
                  {b.vehicle === "driver_car" && b.driver.car_plate && live && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <PlateBadge plate={b.driver.car_plate} small verified={b.driver.car_status === "approved"} />
                      {b.driver.car_details && <span className="text-xs text-gray-700">{b.driver.car_details}</span>}
                    </div>
                  )}
                </PersonRow>
              )}

              {b.status === "accepted" && !b.paid && (
                <div className="space-y-2 rounded-xl bg-indigo-50 p-3">
                  <p className="text-sm font-bold">Pay to confirm your driver</p>
                  <input
                    type="tel"
                    inputMode="tel"
                    className={FIELD}
                    placeholder="M-Pesa number, e.g. 0712345678"
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                  />
                  <button
                    onClick={() => pay(b.id)}
                    disabled={payingId === b.id}
                    className="w-full bg-green-600 text-white font-bold rounded-xl p-3.5 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {payingId === b.id && (
                      <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    )}
                    {payingId === b.id ? "Waiting for payment..." : `Pay KES ${Number(b.price).toLocaleString()} with M-Pesa`}
                  </button>
                  {process.env.NEXT_PUBLIC_TEST_PAYMENTS === "true" && (
                    <button onClick={() => testPay(b.id)} className="w-full bg-amber-500 text-black font-bold rounded-xl p-3">
                      Skip payment (test mode)
                    </button>
                  )}
                  {payMsg && <p className="text-sm font-semibold">{payMsg}</p>}
                </div>
              )}

              {b.status === "accepted" && b.paid && b.timing === "later" && (
                <p className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                  <Icon name="clock" className="w-4 h-4" />
                  Your driver will start at the booked time
                </p>
              )}

              {b.paid && b.status === "in_progress" && (
                <p className="text-xs text-gray-700">The job has started. Contact support if there is a problem.</p>
              )}

              {b.refund_status === "needed" && (
                <p className="flex items-center gap-2 rounded-xl bg-amber-50 text-amber-900 text-sm font-semibold p-3">
                  <Icon name="refund" className="w-4 h-4" />
                  Refund requested. We will send your money back to M-Pesa.
                </p>
              )}

              {(b.status === "requested" || b.status === "accepted") && (
                <button
                  onClick={() => cancel(b.id, b.paid)}
                  className="w-full bg-white border-2 border-red-200 text-red-700 font-bold rounded-xl p-3 text-sm active:scale-[0.98]"
                >
                  {b.paid ? "Cancel and request refund" : "Cancel booking"}
                </button>
              )}
            </div>
          </article>
        );
      })}

      {picking && (
        <MapPicker
          start={destCoords ?? myPos ?? undefined}
          onCancel={() => setPicking(false)}
          onPick={(p) => {
            setPicking(false);
            pickDestination(p);
          }}
        />
      )}
    </div>
  );
}