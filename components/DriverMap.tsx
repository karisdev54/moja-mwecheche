"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/lib/supabase";

const STALE_MS = 60000;

type Driver = {
  id: string;
  lat: number | null;
  lng: number | null;
  is_available: boolean;
  location_updated_at: string | null;
};

export default function DriverMap({ assignedDriverId = null }: { assignedDriverId?: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const assignedRef = useRef<string | null>(assignedDriverId);
  const redrawRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!container.current) return;

    let cancelled = false;
    let fitted: string | null = null;
    const markers: Record<string, mapboxgl.Marker> = {};
    const lastSeen: Record<string, number> = {};
    const latest: Record<string, Driver> = {};
    const assignedFlag: Record<string, boolean> = {};

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [36.8219, -1.2921],
      zoom: 12,
    });

    const removeDriver = (id: string) => {
      markers[id]?.remove();
      delete markers[id];
      delete lastSeen[id];
      delete latest[id];
      delete assignedFlag[id];
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        if (!markers["me"]) {
          markers["me"] = new mapboxgl.Marker({ color: "#2563eb" }).setLngLat(lngLat).addTo(map);
          map.flyTo({ center: lngLat, zoom: 14 });
        } else {
          markers["me"].setLngLat(lngLat);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    // Draws one driver: red if assigned to me, green otherwise
    const draw = (d: Driver) => {
      if (cancelled || d.lat === null || d.lng === null) return;
      const isAssigned = d.id === assignedRef.current;

      if (markers[d.id] && assignedFlag[d.id] !== isAssigned) {
        markers[d.id].remove();
        delete markers[d.id];
      }

      if (markers[d.id]) {
        markers[d.id].setLngLat([d.lng, d.lat]);
      } else {
        markers[d.id] = new mapboxgl.Marker({ color: isAssigned ? "#dc2626" : "#16a34a" })
          .setLngLat([d.lng, d.lat])
          .addTo(map);
        assignedFlag[d.id] = isAssigned;
      }

      if (isAssigned && fitted !== d.id) {
        fitted = d.id;
        if (markers["me"]) {
          const bounds = new mapboxgl.LngLatBounds()
            .extend(markers["me"].getLngLat())
            .extend([d.lng, d.lat]);
          map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
        } else {
          map.flyTo({ center: [d.lng, d.lat], zoom: 14 });
        }
      }
      if (!isAssigned && fitted === d.id) fitted = null;
    };

    redrawRef.current = () => Object.values(latest).forEach(draw);

    const upsertDriver = (d: Driver) => {
      if (cancelled || !d || !d.id) return;
      const updatedAt = d.location_updated_at ? new Date(d.location_updated_at).getTime() : 0;
      const isFresh = Date.now() - updatedAt < STALE_MS;

      if (!d.is_available || d.lat === null || d.lng === null || !isFresh) {
        removeDriver(d.id);
        return;
      }
      lastSeen[d.id] = Date.now();
      latest[d.id] = d;
      draw(d);
    };

    supabase
      .from("drivers")
      .select("id,lat,lng,is_available,location_updated_at")
      .eq("is_available", true)
      .gte("location_updated_at", new Date(Date.now() - STALE_MS).toISOString())
      .then(({ data }: { data: Driver[] | null }) => {
        if (cancelled) return;
        data?.forEach(upsertDriver);
      });

    const channel = supabase
      .channel("drivers-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        (payload: { eventType: string; new: Partial<Driver>; old: Partial<Driver> }) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            if (payload.old?.id) removeDriver(payload.old.id);
            return;
          }
          upsertDriver(payload.new as Driver);
        }
      )
      .subscribe();

    const sweep = setInterval(() => {
      Object.keys(markers).forEach((id) => {
        if (id === "me") return;
        if (Date.now() - (lastSeen[id] ?? 0) > STALE_MS) removeDriver(id);
      });
    }, 15000);

    return () => {
      cancelled = true;
      redrawRef.current = () => {};
      navigator.geolocation.clearWatch(watchId);
      clearInterval(sweep);
      supabase.removeChannel(channel);
      Object.keys(markers).forEach((id) => markers[id].remove());
      map.remove();
    };
  }, []);

  // When the assigned driver changes, recolor markers without rebuilding the map
  useEffect(() => {
    assignedRef.current = assignedDriverId;
    redrawRef.current();
  }, [assignedDriverId]);

  return <div ref={container} className="h-screen w-full" />;
}