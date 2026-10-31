"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DriverMap from "@/components/DriverMap";
import DriverGate from "@/components/DriverGate";
import CustomerPanel from "@/components/CustomerPanel";
import Sheet from "@/components/Sheet";
import type { RouteView } from "@/lib/mapbox";
import BottomNav from "@/components/BottomNav";
import Loader from "@/components/Loader";

type Profile = { id: string; full_name: string | null; role: string };

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [assignedId, setAssignedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteView | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
                const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        router.replace("/");
        return;
      }
      const userId = s.session.user.id;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;
      if (error) setLoadError(error.message);
      else if (!data) setLoadError("No profile found for this account. Log out and sign up again.");
      else setProfile(data as Profile);
    };

    load();
    return () => {
      active = false;
    };
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loadError) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-red-600">Could not load: {loadError}</p>
        <button onClick={logout} className="color-blue-700 underline font-semibold text-sm">Log out</button>
      </div>
    );
  }

  if (!profile) return <Loader full />;

  return (
    <div className="fixed top-0 left-0 w-full h-dvh overflow-hidden">
      <div className="absolute inset-0">
        <DriverMap assignedDriverId={assignedId} route={route} />
        <BottomNav />
      </div>

      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="bg-white rounded-xl shadow px-4 py-2">
          <p className="font-semibold text-gray-900">{profile.full_name || "User"}</p>
          <p className="text-xs font-semibold text-indigo-700 capitalize">{profile.role}</p>
        </div>
        
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
          <div className="flex justify-center">
            <Link href="/admin" className="bg-black text-white rounded-xl shadow px-6 py-3">
              Open admin panel
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}