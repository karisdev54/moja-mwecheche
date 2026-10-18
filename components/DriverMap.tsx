"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/lib/supabase";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Driver = { id: string; lat: number; lng: number; is_available: boolean };

export default function DriverMap() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Record<string, mapboxgl.Marker>>({});

  useEffect(() => {
    if (!container.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [36.8219, -1.2921], // Nairobi default
      zoom: 12,
    });

    // Customer's live location
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!markers.current["me"]) {
          markers.current["me"] = new mapboxgl.Marker({ color: "#2563eb" })
            .setLngLat([longitude, latitude])
            .addTo(map.current!);
          map.current!.flyTo({ center: [longitude, latitude], zoom: 14 });
        } else {
          markers.current["me"].setLngLat([longitude, latitude]);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    const upsertDriver = (d: Driver) => {
      if (!d.is_available || d.lat == null) {
        markers.current[d.id]?.remove();
        delete markers.current[d.id];
        return;
      }
      if (markers.current[d.id]) {
        markers.current[d.id].setLngLat([d.lng, d.lat]);
      } else {
        markers.current[d.id] = new mapboxgl.Marker({ color: "#16a34a" })
          .setLngLat([d.lng, d.lat])
          .addTo(map.current!);
      }
    };

    // Load drivers already online
    supabase
      .from("drivers")
      .select("id,lat,lng,is_available")
      .eq("is_available", true)
      .then(({ data }) => data?.forEach(upsertDriver));

    // Subscribe to live changes
    const channel = supabase
      .channel("drivers-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        (payload) => upsertDriver(payload.new as Driver)
      )
      .subscribe();

    return () => {
      navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(channel);
    };
  }, []);

  return <div ref={container} className="h-screen w-full" />;
}