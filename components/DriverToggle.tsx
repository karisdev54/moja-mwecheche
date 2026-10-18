"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DriverToggle({ driverId }: { driverId: string }) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!online) {
      supabase.from("drivers").update({ is_available: false }).eq("id", driverId);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from("drivers").update({
          is_available: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          location_updated_at: new Date().toISOString(),
        }).eq("id", driverId);
      },
      console.error,
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [online, driverId]);

  return (
    <button
      onClick={() => setOnline(!online)}
      className={`px-6 py-3 rounded-xl text-white ${online ? "bg-green-600" : "bg-gray-500"}`}
    >
      {online ? "You are online" : "Go online"}
    </button>
  );
}