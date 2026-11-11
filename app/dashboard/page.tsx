"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DriverMap from "@/components/DriverMap";
import DriverGate from "@/components/DriverGate";
import CustomerPanel from "@/components/CustomerPanel";
import Sheet from "@/components/Sheet";
import Loader from "@/components/Loader";
import UserChip from "@/components/UserChip";
import JobCompleteWatcher from "@/components/JobCompleteWatcher";
import Badge from "@/components/Badge";
import { Icon } from "@/components/AdminUI";
import { inboxTotal, useInbox } from "@/lib/inbox";
import { friendlyError } from "@/lib/net";
import type { RouteView } from "@/lib/mapbox";

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  phone: string | null;
  suspended: boolean;
};

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [assignedId, setAssignedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteView | null>(null);
  const [tries, setTries] = useState(0);
  const inbox = useInbox();
  const waiting = inbox ? inboxTotal(inbox) : 0;

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        router.replace("/");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url, phone, suspended")
        .eq("id", s.session.user.id)
        .maybeSingle();

      if (!active) return;
      if (error) return setLoadError(friendlyError(error.message));
      if (!data) return setLoadError("No profile found for this account. Log out and sign up again.");
      if (data.suspended) {
        router.replace("/suspended");
        return;
      }
      setLoadError("");
      setProfile(data as Profile);
    };

    load();
    return () => {
      active = false;
    };
  }, [router, tries]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loadError) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-5" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden text-gray-900 pop-in">
          <div className="h-1.5" style={{ background: "linear-gradient(90deg,#dc2626,#f97316)" }} />
          <div className="p-6 text-center space-y-4">
            <span
              className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "color-mix(in srgb, #dc2626 14%, var(--surface))", color: "#dc2626" }}
            >
              <Icon name="alert" className="w-7 h-7" size={28} />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">Could not load</h1>
              <p className="text-sm text-gray-700 mt-1">{loadError}</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setLoadError("");
                  setTries((t) => t + 1);
                }}
                className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-3.5 active:scale-[0.98]"
              >
                Try again
              </button>
              <button onClick={logout} className="w-full bg-white border-2 border-red-200 text-red-700 font-bold rounded-2xl p-3 active:scale-[0.98]">
                Log out
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) return <Loader full />;

  return (
    <div className="fixed top-0 left-0 w-full h-dvh overflow-hidden">
      <div className="absolute inset-0">
        <DriverMap assignedDriverId={assignedId} route={route} />
      </div>

      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <UserChip
          id={profile.id}
          name={profile.full_name}
          role={profile.role}
          avatar={profile.avatar_url}
          phone={profile.phone}
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col gap-2 px-3 pt-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        {profile.role === "customer" && (
          <div className="w-full max-w-md mx-auto">
            <Sheet title="Book a driver">
              <CustomerPanel userId={profile.id} onAssignedChange={setAssignedId} onRouteChange={setRoute} />
            </Sheet>
          </div>
        )}

        {profile.role === "driver" && (
          <div className="w-full max-w-md mx-auto flex flex-col gap-2">
            <DriverGate driverId={profile.id} onRouteChange={setRoute} />
          </div>
        )}

        {profile.role === "admin" && (
          <Link
            href="/admin"
            className="btn-shine grad-bg relative w-full max-w-md mx-auto flex items-center gap-3 text-white rounded-2xl p-3.5 shadow-xl active:scale-[0.98]"
          >
            <span className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Icon name="chart" className="w-6 h-6" />
            </span>
            <span className="flex-1">
              <span className="block font-bold">Admin dashboard</span>
              <span className="block text-xs text-white/85">
                {waiting > 0 ? `${waiting} thing${waiting === 1 ? "" : "s"} waiting for you` : "Everything is up to date"}
              </span>
            </span>
            {waiting > 0 && <Badge n={waiting} />}
            <Icon name="chevron" className="w-5 h-5" />
          </Link>
        )}
      </div>

      {(profile.role === "customer" || profile.role === "driver") && (
        <JobCompleteWatcher userId={profile.id} role={profile.role} />
      )}
    </div>
  );
}