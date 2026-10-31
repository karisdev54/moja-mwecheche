"use client";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/lib/supabase";
import type { RouteView } from "@/lib/mapbox";
import { useTheme } from "@/lib/theme";

const STALE_MS = 60000;

const styleFor = (t: string) =>
  t === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12";

type Driver = {
  id: string;
  lat: number | null;
  lng: number | null;
  is_available: boolean;
  location_updated_at: string | null;
};

export default function DriverMap({
  assignedDriverId = null,
  route = null,
}: {
  assignedDriverId?: string | null;
  route?: RouteView | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleRef = useRef("");
  const assignedRef = useRef<string | null>(assignedDriverId);
  const routeRef = useRef<RouteView | null>(route);
  const redrawRef = useRef<() => void>(() => {});
  const drawRouteRef = useRef<() => void>(() => {});

  // Hooks must be called here, at the top of the component, never inside an effect
  const theme = useTheme();

  useEffect(() => {
    if (!container.current) return;
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
      console.error("Mapbox token is missing");
      return;
    }

    let cancelled = false;
    let loaded = false;
    let fitted: string | null = null;
    let destMarker: mapboxgl.Marker | null = null;
    const markers: Record<string, mapboxgl.Marker> = {};
    const lastSeen: Record<string, number> = {};
    const latest: Record<string, Driver> = {};
    const assignedFlag: Record<string, boolean> = {};

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

    const initialStyle = styleFor(document.documentElement.dataset.theme ?? "light");
    styleRef.current = initialStyle;

    const map = new mapboxgl.Map({
      container: container.current,
      style: initialStyle,
      center: [36.8219, -1.2921],
      zoom: 12,
    });
    mapRef.current = map;

    // Route line and destination pin
    const drawRoute = () => {
      if (cancelled || !loaded) return;
      const r = routeRef.current;
      const data = {
        type: "FeatureCollection" as const,
        features: r
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: { type: "LineString" as const, coordinates: r.geometry },
              },
            ]
          : [],
      };

      try {
        const src = map.getSource("route") as mapboxgl.GeoJSONSource | undefined;
        if (src) {
          src.setData(data);
        } else {
          map.addSource("route", { type: "geojson", data });
          map.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#ffffff", "line-width": 9 },
          });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#4338ca", "line-width": 5 },
          });
        }
      } catch {
        return; // the map style is switching; it redraws itself when ready
      }

      destMarker?.remove();
      destMarker = null;
      if (!r) return;

      destMarker = new mapboxgl.Marker({ color: "#f59e0b" }).setLngLat(r.to).addTo(map);

      // Guidance mode: stay on the driver instead of fitting the whole route
      if (r.follow) {
        map.easeTo({ center: r.from, zoom: Math.max(map.getZoom(), 15.5), duration: 900 });
        return;
      }

      const bounds = new mapboxgl.LngLatBounds(r.from, r.from);
      r.geometry.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, {
        padding: { top: 90, bottom: 280, left: 40, right: 40 },
        maxZoom: 16,
        duration: 800,
      });
    };
    drawRouteRef.current = drawRoute;
    map.on("load", () => {
      loaded = true;
      drawRoute();
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
          if (!routeRef.current) map.flyTo({ center: lngLat, zoom: 14 });
        } else {
          markers["me"].setLngLat(lngLat);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

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

      if (isAssigned && fitted !== d.id && !routeRef.current) {
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
      drawRouteRef.current = () => {};
      navigator.geolocation.clearWatch(watchId);
      clearInterval(sweep);
      supabase.removeChannel(channel);
      destMarker?.remove();
      Object.keys(markers).forEach((id) => markers[id].remove());
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    assignedRef.current = assignedDriverId;
    redrawRef.current();
  }, [assignedDriverId]);

  useEffect(() => {
    routeRef.current = route;
    drawRouteRef.current();
  }, [route]);

  // Switch the map between light and dark when the theme changes
  useEffect(() => {
    const m = mapRef.current;
    const next = styleFor(theme);
    if (!m || styleRef.current === next) return;
    styleRef.current = next;
    m.setStyle(next);
    // A new style wipes the route layers, so draw them again once it has loaded
    m.once("style.load", () => drawRouteRef.current());
  }, [theme]);

  return <div ref={container} className="h-full w-full" />;
}