"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import DriverRating from "@/components/DriverRating";
import RateDriver from "@/components/RateDriver";

type Item = {
  id: string;
  task_type: string;
  scheduled_at: string;
  duration_hours: number;
  destination: string | null;
  price: number;
  status: string;
  paid: boolean;
  driver_id: string | null;
  driver_earnings: number | null;
  refund_status: string;
  my_rating: number | null;
  review: { rating: number; comment: string | null } | null;
};
type Data = { userId: string; role: string; items: Item[] };

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-900",
  accepted: "bg-blue-100 text-blue-900",
  in_progress: "bg-violet-100 text-violet-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-gray-200 text-gray-900",
  expired: "bg-red-100 text-red-900",
};

const FILTERS: { label: string; match: string[] | null }[] = [
  { label: "All", match: null },
  { label: "Active", match: ["requested", "accepted", "in_progress"] },
  { label: "Done", match: ["completed"] },
  { label: "Cancelled", match: ["cancelled", "expired"] },
];

async function fetchActivity(): Promise<Data | "login"> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return "login";
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  const role = me?.role ?? "customer";

  const column = role === "driver" ? "driver_id" : "customer_id";
  const { data } = await supabase
    .from("bookings")
    .select("id,task_type,scheduled_at,duration_hours,destination,price,status,paid,driver_id,driver_earnings,refund_status")
    .eq(column, u.user.id)
    .order("scheduled_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as Omit<Item, "my_rating" | "review">[];

  let reviews: { booking_id: string; rating: number; comment: string | null }[] = [];
  if (rows.length > 0) {
    const { data: r } = await supabase
      .from("reviews")
      .select("booking_id,rating,comment")
      .in("booking_id", rows.map((x) => x.id));
    reviews = (r ?? []) as typeof reviews;
  }

  return {
    userId: u.user.id,
    role,
    items: rows.map((i) => {
      const rv = reviews.find((x) => x.booking_id === i.id);
      return {
        ...i,
        my_rating: role === "driver" ? null : rv?.rating ?? null,
        review: role === "driver" && rv ? { rating: rv.rating, comment: rv.comment } : null,
      };
    }),
  };
}

export default function ActivityPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetchActivity().then((r) => {
      if (!active) return;
      if (r === "login") router.replace("/login");
      else setData(r);
    });
    return () => {
      active = false;
    };
  }, [router, tick]);

  if (!data) return <p className="p-6">Loading...</p>;

  const isDriver = data.role === "driver";
  const done = data.items.filter((i) => i.status === "completed" && i.paid);
  const total = done.reduce((s, i) => s + Number(isDriver ? i.driver_earnings ?? 0 : i.price), 0);

  const match = FILTERS[filter].match;
  const shown = match ? data.items.filter((i) => match.includes(i.status)) : data.items;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4 text-gray-900">
        <h1 className="text-2xl font-bold">Activity</h1>

        {isDriver && <DriverRating driverId={data.userId} />}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-sm text-gray-700">{isDriver ? "Jobs completed" : "Trips completed"}</p>
            <p className="text-2xl font-bold">{done.length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow p-4">
            <p className="text-sm text-gray-700">{isDriver ? "Total earned" : "Total spent"}</p>
            <p className="text-2xl font-bold text-indigo-800">KES {Math.round(total).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFilter(i)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border-2 whitespace-nowrap ${
                filter === i ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {shown.length === 0 && <p className="text-gray-700">Nothing here yet.</p>}

        {shown.map((i) => (
          <div key={i.id} className="bg-white rounded-2xl shadow p-4 text-sm space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-bold">{i.task_type}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[i.status] ?? "bg-gray-200"}`}>
                {i.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-gray-700">
              {new Date(i.scheduled_at).toLocaleString()} · {i.duration_hours}h
            </p>
            {i.destination && <p>📍 {i.destination}</p>}
            <p className="font-semibold">
              KES {Number(isDriver && i.driver_earnings ? i.driver_earnings : i.price).toLocaleString()}
              {i.paid && <span className="ml-2 text-green-700">Paid ✓</span>}
            </p>

            {i.refund_status === "needed" && (
              <p className="font-semibold text-indigo-800">Refund requested. We will send it to your M-Pesa.</p>
            )}
            {i.refund_status === "refunded" && <p className="font-semibold text-green-700">Refunded ✓</p>}

            {/* Customer: rate the driver, or see the rating given */}
            {!isDriver && i.status === "completed" && i.driver_id && i.my_rating === null && (
              <RateDriver bookingId={i.id} customerId={data.userId} onDone={() => setTick((t) => t + 1)} />
            )}
            {!isDriver && i.my_rating !== null && (
              <p className="font-semibold">
                You rated this driver <span className="text-yellow-500">{"★".repeat(i.my_rating)}</span>
              </p>
            )}

            {/* Driver: the rating the customer gave */}
            {isDriver && i.review && (
              <p className="font-semibold">
                Customer rated you <span className="text-yellow-500">{"★".repeat(i.review.rating)}</span>
                {i.review.comment ? ` “${i.review.comment}”` : ""}
              </p>
            )}
          </div>
        ))}
      </div>
      <BottomNav />
    </main>
  );
}