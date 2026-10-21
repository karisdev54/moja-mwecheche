"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DriverMap from "@/components/DriverMap";
import DriverGate from "@/components/DriverGate";
import CustomerPanel from "@/components/CustomerPanel";

type Profile = { id: string; full_name: string | null; role: string };

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [assignedId, setAssignedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userData.user.id)
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
        <button onClick={logout} className="underline text-sm">
          Log out
        </button>
      </div>
    );
  }

  if (!profile) return <p className="p-6">Loading...</p>;

  return (
    <div className="relative">
      <DriverMap assignedDriverId={assignedId} />

      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <div className="bg-white rounded-xl shadow px-4 py-2">
          <p className="font-semibold">{profile.full_name || "User"}</p>
          <p className="text-xs text-gray-500 capitalize">{profile.role}</p>
        </div>
        <button onClick={logout} className="bg-white rounded-xl shadow px-4 py-2 text-sm">
          Log out
        </button>
      </div>

      {profile.role === "customer" && (
        <div className="absolute bottom-4 left-4 right-4 max-w-md mx-auto">
          <CustomerPanel userId={profile.id} onAssignedChange={setAssignedId} />
        </div>
      )}

      {profile.role === "driver" && <DriverGate driverId={profile.id} />}

      {profile.role === "admin" && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <Link href="/admin" className="bg-black text-white rounded-xl shadow px-6 py-3">
            Open admin panel
          </Link>
        </div>
      )}
    </div>
  );
}