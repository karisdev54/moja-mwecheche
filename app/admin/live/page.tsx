"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DriverMap, { type MapPin } from "@/components/DriverMap";
import Sheet from "@/components/Sheet";
import Loader from "@/components/Loader";
import { Icon, Pill, Tile } from "@/components/AdminUI";
import { friendlyError } from "@/lib/net";

type Job = {
  id: string;
  status: string;
  timing: string;
  task_type: string;
  price: number;
  paid: boolean;
  scheduled_at: string;
  pickup_lat: number;
  pickup_lng: number;
  customer_name: string | null;
  driver_name: string | null;
};
type Live = { online: number; waiting: number; active: number; jobs: Job[] };

const ST: Record<string, { label: string; color: string; icon: string }> = {
  requested: { label: "Waiting", color: "#d97706", icon: "clock" },
  accepted: { label: "Accepted", color: "#2563eb", icon: "car" },
  in_progress: { label: "On trip", color: "#7c3aed", icon: "trend" },
};

export default function LivePage() {
  const router = useRouter();
  const [live, setLive] = useState<Live | null>(null);
  const [err, setErr] = useState("");
  const [tries, setTries] = useState(0);
  const [focus, setFocus] = useState<{ lng: number; lat: number } | null>(null);
  const [sheet, setSheet] = useState({ k: 0, open: true });

  useEffect(() => {
    let active = true;

    const run = async () => {
      const { data, error } = await supabase.rpc("admin_live");
      if (!active) return;
      if (error) return setErr(friendlyError(error.message));
      if (data) {
        setLive(data as Live);
        setErr("");
      }
    };

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return router.replace("/login");
      const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      if (!active) return;
      if (p?.role !== "admin") return router.replace("/dashboard");
      run();
    })();

    const timer = setInterval(run, 15000);
    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, run)
      .subscribe();

    return () => {
      active = false;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [router, tries]);

  const pins: MapPin[] = useMemo(
    () =>
      (live?.jobs ?? []).map((j) => ({
        id: j.id,
        lng: j.pickup_lng,
        lat: j.pickup_lat,
        color: ST[j.status]?.color ?? "#6b7280",
      })),
    [live]
  );

  if (!live && err) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center p-5">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden text-gray-900">
          <div className="h-1.5" style={{ background: "linear-gradient(90deg,#dc2626,#f97316)" }} />
          <div className="p-6 text-center space-y-4">
            <span
              className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, #dc2626 14%, var(--surface))", color: "#dc2626" }}
            >
              <Icon name="alert" className="w-7 h-7" size={28} />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">Could not load the live map</h1>
              <p className="text-sm text-gray-700 mt-1">{err}</p>
            </div>
            <button
              onClick={() => {
                setErr("");
                setTries((t) => t + 1);
              }}
              className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-3.5 active:scale-[0.98]"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!live) return <Loader full />;

  const stats = [
    { label: "Drivers online", value: live.online, color: "#059669" },
    { label: "Waiting", value: live.waiting, color: "#d97706" },
    { label: "Active trips", value: live.active, color: "#7c3aed" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 top-[var(--bar)] lg:left-[var(--side)] overflow-hidden transition-[left] duration-300 ease-out">
      <div className="absolute inset-0">
        <DriverMap showCount overview pins={pins} focus={focus} />
      </div>

      <div className="absolute top-0 left-0 z-10 px-3 pt-3">
        <div className="inline-flex items-center gap-2 bg-white rounded-full shadow-lg h-11 pl-3.5 pr-4 text-gray-900">
          <span className="relative flex w-2 h-2">
            <span className="live-ping absolute inline-flex w-full h-full rounded-full bg-emerald-500" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-bold">Live operations</span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md mx-auto">
          <Sheet key={sheet.k} title="Live now" defaultOpen={sheet.open}>
            <div className="grid grid-cols-3 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl bg-indigo-50 p-3 text-center">
                  <p className="text-2xl font-extrabold leading-none" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[11px] font-semibold text-gray-700 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-700">
              {Object.values(ST).map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>

            {live.jobs.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 p-3 text-sm">
                <Tile name="inbox" color="#6366f1" size="w-10 h-10" />
                <p className="flex-1 text-gray-800">No requests or trips right now.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {live.jobs.map((j) => {
                  const st = ST[j.status] ?? { label: j.status, color: "#6b7280", icon: "car" };
                  return (
                    <button
                      key={j.id}
                      onClick={() => {
                        setFocus({ lng: j.pickup_lng, lat: j.pickup_lat });
                        setSheet((s) => ({ k: s.k + 1, open: false })); // fold the panel so the pin is visible
                      }}
                      className="w-full flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-3 text-left active:scale-[0.98] active:bg-indigo-50"
                    >
                      <Tile name={st.icon} color={st.color} size="w-10 h-10" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold truncate">{j.task_type}</span>
                        <span className="block text-xs text-gray-700 truncate">
                          {j.customer_name || "Customer"}
                          {j.driver_name ? `, with ${j.driver_name}` : ", no driver yet"}
                        </span>
                      </span>
                      <span className="text-right shrink-0 space-y-1">
                        <Pill text={st.label} color={st.color} />
                        <span className="block text-xs font-bold">KES {Math.round(Number(j.price)).toLocaleString()}</span>
                      </span>
                      <Icon name="locate" className="w-4 h-4 text-gray-700" />
                    </button>
                  );
                })}
              </div>
            )}
          </Sheet>
        </div>
      </div>
    </div>
  );
}