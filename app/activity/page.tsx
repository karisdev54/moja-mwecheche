"use client";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DriverRating from "@/components/DriverRating";
import RateDriver from "@/components/RateDriver";
import Loader from "@/components/Loader";
import { Icon, Num, Tile } from "@/components/AdminUI";
import { confirmDialog } from "@/lib/dialog";

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
  rating_skipped: boolean;
  my_rating: number | null;
  review: { rating: number; comment: string | null } | null;
  route_km: number | null;
};
type Data = { userId: string; role: string; items: Item[] };

const STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: "Awaiting driver", color: "#d97706" },
  accepted: { label: "Accepted", color: "#2563eb" },
  in_progress: { label: "In progress", color: "#7c3aed" },
  completed: { label: "Completed", color: "#059669" },
  cancelled: { label: "Cancelled", color: "#6b7280" },
  expired: { label: "Expired", color: "#dc2626" },
};

const FILTERS: { label: string; match: string[] | null }[] = [
  { label: "All", match: null },
  { label: "Active", match: ["requested", "accepted", "in_progress"] },
  { label: "Done", match: ["completed"] },
  { label: "Cancelled", match: ["cancelled", "expired"] },
];

const money = (n: number) => `KES ${Math.round(Number(n)).toLocaleString()}`;
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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

async function fetchActivity(): Promise<Data | "login"> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return "login";
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  const role = me?.role ?? "customer";

  const column = role === "driver" ? "driver_id" : "customer_id";
  const { data } = await supabase
    .from("bookings")
    .select(
      "id,task_type,scheduled_at,duration_hours,destination,price,status,paid,driver_id,driver_earnings,refund_status,rating_skipped,route_km"
    )
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
  const [reopen, setReopen] = useState<string[]>([]);

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

  const refresh = () => setTick((t) => t + 1);

  const skip = async (id: string) => {
    await supabase.from("bookings").update({ rating_skipped: true }).eq("id", id);
    setReopen((r) => r.filter((x) => x !== id));
    refresh();
  };

  const remove = async (id: string) => {
    const ok = await confirmDialog({
      title: "Remove this request?",
      message: "It will be deleted completely.",
      confirmText: "Remove",
      danger: true,
    });
    if (!ok) return;
    await supabase.from("bookings").delete().eq("id", id);
    refresh();
  };

  if (!data) return <Loader full />;

  const isDriver = data.role === "driver";
  const done = data.items.filter((i) => i.status === "completed" && i.paid);
  const total = done.reduce((s, i) => s + Number(isDriver ? i.driver_earnings ?? 0 : i.price), 0);

  const counts = FILTERS.map((f) =>
    f.match ? data.items.filter((i) => f.match!.includes(i.status)).length : data.items.length
  );
  const match = FILTERS[filter].match;
  const shown = match ? data.items.filter((i) => match.includes(i.status)) : data.items;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-5 text-gray-900">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight">Activity</h1>
          <p className="text-sm text-gray-700">{isDriver ? "Your jobs and earnings" : "Your trips and payments"}</p>
        </header>

        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
            {isDriver ? "Total earned" : "Total spent"}
          </p>
          <p className="text-4xl font-extrabold tracking-tight mt-1">
            <Num value={Math.round(total)} prefix="KES " />
          </p>
          <div className="flex gap-6 mt-3 text-sm">
            <div>
              <p className="text-white/80 text-xs">{isDriver ? "Jobs completed" : "Trips completed"}</p>
              <p className="font-bold">
                <Num value={done.length} />
              </p>
            </div>
            <div>
              <p className="text-white/80 text-xs">All bookings</p>
              <p className="font-bold">
                <Num value={data.items.length} />
              </p>
            </div>
          </div>
        </section>

        {isDriver && <DriverRating driverId={data.userId} showComments={false} />}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f, i) => {
            const on = filter === i;
            return (
              <button
                key={f.label}
                onClick={() => setFilter(i)}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold border-2 ${
                  on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
                }`}
              >
                {f.label}
                <span
                  className={`min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                    on ? "bg-white/25" : "bg-indigo-100 text-indigo-800"
                  }`}
                >
                  {counts[i]}
                </span>
              </button>
            );
          })}
        </div>

        {shown.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-8 text-center space-y-2">
            <div className="flex justify-center">
              <Tile name="inbox" color="#6366f1" size="w-14 h-14" />
            </div>
            <p className="font-bold">Nothing here yet</p>
            <p className="text-sm text-gray-700">
              {isDriver ? "Jobs you accept will show up here." : "Your bookings will show up here."}
            </p>
          </div>
        )}

        {shown.map((i, idx) => {
          const st = STATUS[i.status] ?? { label: i.status, color: "#6b7280" };
          const label = dayLabel(i.scheduled_at);
          const head = idx === 0 || dayLabel(shown[idx - 1].scheduled_at) !== label;
          const amount = Number(isDriver && i.driver_earnings ? i.driver_earnings : i.price);
          const canRemove = !isDriver && !i.paid && !i.driver_id && (i.status === "expired" || i.status === "cancelled");

          return (
            <Fragment key={i.id}>
              {head && (
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 pt-1">{label}</h2>
              )}

              <article
                className="slide-in bg-white rounded-2xl shadow overflow-hidden flex"
                style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
              >
                <div className="w-1.5 shrink-0" style={{ background: st.color }} />
                <div className="flex-1 min-w-0 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold leading-tight">{i.task_type}</h3>
                      <p className="text-xs text-gray-700 mt-1 flex items-center gap-1.5">
                        <Icon name="clock" className="w-3.5 h-3.5" />
                        {timeLabel(i.scheduled_at)}
                        <span aria-hidden="true">·</span>
                        {i.route_km ?? "-"} km
                      </p>
                    </div>
                    <Pill text={st.label} color={st.color} />
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                        {isDriver ? "You earn" : "Amount"}
                      </p>
                      <p className="text-2xl font-extrabold tracking-tight">{money(amount)}</p>
                    </div>
                    {i.paid && <Pill text="Paid" color="#059669" />}
                  </div>

                  {i.destination && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 p-3">
                      <span className="text-indigo-700 mt-0.5">
                        <Icon name="pin" className="w-4 h-4" />
                      </span>
                      <p className="text-sm font-semibold break-words min-w-0">{i.destination}</p>
                    </div>
                  )}

                  {i.refund_status !== "none" && (
                    <div
                      className="flex items-center gap-2.5 rounded-xl p-3 text-sm font-semibold"
                      style={{
                        background: `color-mix(in srgb, ${i.refund_status === "refunded" ? "#059669" : "#d97706"} 12%, var(--surface))`,
                        color: i.refund_status === "refunded" ? "#059669" : "#d97706",
                      }}
                    >
                      <Icon name="refund" className="w-4 h-4" />
                      {i.refund_status === "refunded"
                        ? "Refund sent to your M-Pesa"
                        : "Refund requested. We will send it to your M-Pesa."}
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-1">
                    <Link href={`/report?booking=${i.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700">
                      <Icon name="flag" className="w-4 h-4" />
                      Report a problem
                    </Link>
                    {canRemove && (
                      <button
                        onClick={() => remove(i.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Rating: only here, at the bottom of a completed job */}
                  {!isDriver && i.status === "completed" && i.driver_id && (
                    <div className="border-t border-indigo-100 pt-3">
                      {i.my_rating !== null ? (
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <span className="text-yellow-500 tracking-wide">{"★".repeat(i.my_rating)}</span>
                          You rated this driver
                        </p>
                      ) : i.rating_skipped && !reopen.includes(i.id) ? (
                        <button
                          onClick={() => setReopen([...reopen, i.id])}
                          className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700"
                        >
                          <Icon name="star" className="w-4 h-4" />
                          Rate this driver
                        </button>
                      ) : (
                        <RateDriver
                          bookingId={i.id}
                          customerId={data.userId}
                          onDone={refresh}
                          onSkip={() => skip(i.id)}
                        />
                      )}
                    </div>
                  )}

                  {isDriver && i.review && (
                    <div className="border-t border-indigo-100 pt-3 text-sm">
                      <p className="flex items-center gap-2 font-semibold">
                        <span className="text-yellow-500 tracking-wide">{"★".repeat(i.review.rating)}</span>
                        Customer rating
                      </p>
                      {i.review.comment && <p className="text-gray-800 mt-1">“{i.review.comment}”</p>}
                    </div>
                  )}
                </div>
              </article>
            </Fragment>
          );
        })}
      </div>
    </main>
  );
}