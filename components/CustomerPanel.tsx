"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const HOURLY_RATE = 1000; // KES per hour, keep in sync with hourly_rate in the bookings_guard SQL
const TASKS = ["Airport transfer", "Wedding / event", "Business trip", "Errand / delivery", "Other"];

type Booking = {
  id: string;
  task_type: string;
  scheduled_at: string;
  duration_hours: number;
  destination: string | null;
  price: number;
  status: string;
  paid: boolean;
  driver_id: string | null;
  driver: { full_name: string | null; phone: string | null } | null;
};

async function fetchMyBookings(userId: string): Promise<Booking[]> {
  const { data } = await supabase
    .from("bookings")
    .select(
      "id,task_type,scheduled_at,duration_hours,destination,price,status,paid,driver_id,driver:driver_id(full_name,phone)"
    )
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);
  return (data ?? []) as unknown as Booking[];
}

export default function CustomerPanel({
  userId,
  onAssignedChange,
}: {
  userId: string;
  onAssignedChange?: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState(TASKS[0]);
  const [when, setWhen] = useState("");
  const [hours, setHours] = useState(1);
  const [destination, setDestination] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [msg, setMsg] = useState("");
  const [payPhone, setPayPhone] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState("");

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

  const submit = () => {
    setMsg("");
    if (!when) {
      setMsg("Pick a date and time");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.from("bookings").insert({
          customer_id: userId,
          task_type: task,
          scheduled_at: new Date(when).toISOString(),
          duration_hours: hours,
          pickup_lat: pos.coords.latitude,
          pickup_lng: pos.coords.longitude,
          destination,
          price: hours * HOURLY_RATE, // preview only, the database sets the real price
        });
        if (error) setMsg(error.message);
        else {
          setOpen(false);
          setDestination("");
          reload();
        }
      },
      () => setMsg("Please allow location so the driver knows where to pick you up")
    );
  };

  const cancel = async (id: string) => {
    await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    reload();
  };

  const pay = async (id: string) => {
    setPayMsg("");
    setPayingId(id);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/payments/stk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId: id, phone: payPhone }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      setPayMsg(json.message ?? json.error ?? "Something went wrong.");
    } catch {
      setPayMsg("Network error. Please try again.");
    }
    setPayingId(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3 max-h-[60vh] overflow-y-auto">
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full bg-black text-white rounded-xl p-3">
          Book a driver
        </button>
      ) : (
        <div className="space-y-2">
          <select className="w-full border rounded-lg p-2" value={task} onChange={(e) => setTask(e.target.value)}>
            {TASKS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input type="datetime-local" className="w-full border rounded-lg p-2" value={when} onChange={(e) => setWhen(e.target.value)} />
          <input type="number" min={1} step={1} className="w-full border rounded-lg p-2" value={hours} onChange={(e) => setHours(Math.max(1, Number(e.target.value)))} />
          <p className="text-xs text-gray-500">Duration in hours</p>
          <input className="w-full border rounded-lg p-2" placeholder="Destination (optional)" value={destination} onChange={(e) => setDestination(e.target.value)} />
          <p className="text-sm font-semibold">Estimated price: KES {hours * HOURLY_RATE}</p>
          {msg && <p className="text-red-600 text-sm">{msg}</p>}
          <div className="flex gap-2">
            <button onClick={submit} className="flex-1 bg-black text-white rounded-lg p-2">Request</button>
            <button onClick={() => setOpen(false)} className="flex-1 border rounded-lg p-2">Close</button>
          </div>
        </div>
      )}

      {bookings.map((b) => (
        <div key={b.id} className="border rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold">{b.task_type}</span>
            <span className="capitalize">{b.status.replace("_", " ")}</span>
          </div>
          <p className="text-gray-500">
            {new Date(b.scheduled_at).toLocaleString()} · {b.duration_hours}h · KES {b.price}
          </p>

          {b.driver && (b.status === "accepted" || b.status === "in_progress") && (
            <p className="mt-1">
              Driver: <span className="font-semibold">{b.driver.full_name || "Assigned driver"}</span>
              {b.driver.phone && (
                <a href={`tel:${b.driver.phone}`} className="ml-2 text-blue-600 underline">
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
                className="w-full border rounded-lg p-2"
                placeholder="M-Pesa number, e.g. 0712345678"
                value={payPhone}
                onChange={(e) => setPayPhone(e.target.value)}
              />
              <button
                onClick={() => pay(b.id)}
                disabled={payingId === b.id}
                className="w-full bg-green-600 text-white rounded-lg p-2 disabled:opacity-50"
              >
                {payingId === b.id ? "Sending prompt..." : `Pay KES ${b.price} with M-Pesa`}
              </button>
              {payMsg && <p className="text-xs text-gray-600">{payMsg}</p>}
            </div>
          )}

          {(b.status === "requested" || b.status === "accepted") && !b.paid && (
            <button onClick={() => cancel(b.id)} className="text-red-600 underline mt-2">Cancel</button>
          )}
          {b.paid && (b.status === "accepted" || b.status === "requested") && (
            <p className="text-xs text-gray-500 mt-1">To cancel a paid booking, contact support for a refund.</p>
          )}
        </div>
      ))}
    </div>
  );
}