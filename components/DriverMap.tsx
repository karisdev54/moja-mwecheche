"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/lib/supabase";
import type { RouteView } from "@/lib/mapbox";
import { useTheme } from "@/lib/theme";
import { Icon } from "@/components/AdminUI";

const STALE_MS = 60000;
const GLIDE_MS = 1000;

type LL = [number, number];

const styleFor = (theme: string) =>
  theme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12";
type Driver = {
  id: string;
  lat: number | null;
  lng: number | null;
  is_available: boolean;
  location_updated_at: string | null;
};

function metersBetween(a: LL, b: LL): number {
  const k = 111320;
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180) * k;
  const dy = (b[1] - a[1]) * k;
  return Math.hypot(dx, dy);
}

function bearing(a: LL, b: LL): number {
  const r = Math.PI / 180;
  const dLng = (b[0] - a[0]) * r;
  const y = Math.sin(dLng) * Math.cos(b[1] * r);
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function carEl(assigned: boolean): HTMLElement {
  const s = assigned ? 46 : 36;
  const color = assigned ? "#dc2626" : "#16a34a";
  const el = document.createElement("div");
  el.style.width = `${s}px`;
  el.style.height = `${s}px`;
  el.innerHTML = `
    <div class="car-wrap">
      ${assigned ? '<span class="car-pulse"></span>' : ""}
      <div class="car-rot">
        <svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">
          <rect x="6.5" y="1.5" width="11" height="21" rx="4.5" fill="${color}" stroke="#fff" stroke-width="1.6"/>
          <rect x="8.4" y="5.5" width="7.2" height="4.2" rx="1.5" fill="#fff" opacity=".9"/>
          <rect x="8.4" y="15.2" width="7.2" height="3.4" rx="1.3" fill="#fff" opacity=".6"/>
        </svg>
      </div>
    </div>`;
  return el;
}

function meEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "26px";
  el.style.height = "26px";
  el.innerHTML = '<div class="me-dot"><span class="me-ring"></span><span class="me-core"></span></div>';
  return el;
}

function pinEl(): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "30px";
  el.style.height = "40px";
  el.innerHTML = `
    <svg viewBox="0 0 24 32" width="30" height="40" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#f59e0b" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4.5" fill="#fff"/>
    </svg>`;
  return el;
}

export default function DriverMap({
  assignedDriverId = null,
  route = null,
  showCount = false,
}: {
  assignedDriverId?: string | null;
  route?: RouteView | null;
  showCount?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleRef = useRef("");
  const meRef = useRef<LL | null>(null);
  const assignedRef = useRef<string | null>(assignedDriverId);
  const routeRef = useRef<RouteView | null>(route);
  const redrawRef = useRef<() => void>(() => {});
  const drawRouteRef = useRef<() => void>(() => {});
  const [count, setCount] = useState(0);

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
    let raf = 0;
    const markers: Record<string, mapboxgl.Marker> = {};
    const rots: Record<string, HTMLElement | null> = {};
    const lastPos: Record<string, LL> = {};
    const lastSeen: Record<string, number> = {};
    const latest: Record<string, Driver> = {};
    const assignedFlag: Record<string, boolean> = {};
    const anims: Record<string, { from: LL; to: LL; start: number }> = {};

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

    const initialStyle = styleFor(document.documentElement.dataset.theme ?? "light");
    styleRef.current = initialStyle;

    const map = new mapboxgl.Map({
      container: container.current,
      style: initialStyle,
      center: [36.8219, -1.2921],
      zoom: 14,
    });
    mapRef.current = map;

    // One animation loop moves every gliding car, and stops when nothing is moving
    const tick = (t: number) => {
      let any = false;
      for (const id of Object.keys(anims)) {
        const a = anims[id];
        const p = Math.min(1, Math.max(0, (t - a.start) / GLIDE_MS));
        const e = 1 - Math.pow(1 - p, 3);
        markers[id]?.setLngLat([a.from[0] + (a.to[0] - a.from[0]) * e, a.from[1] + (a.to[1] - a.from[1]) * e]);
        if (p >= 1) delete anims[id];
        else any = true;
      }
      raf = any ? requestAnimationFrame(tick) : 0;
    };

    const glide = (id: string, to: LL) => {
      const m = markers[id];
      if (!m) return;
      const cur = m.getLngLat();
      anims[id] = { from: [cur.lng, cur.lat], to, start: performance.now() };
      if (!raf) raf = requestAnimationFrame(tick);
    };

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
          const layout = { "line-join": "round" as const, "line-cap": "round" as const };
          map.addLayer({
            id: "route-glow",
            type: "line",
            source: "route",
            layout,
            paint: { "line-color": "#6366f1", "line-width": 18, "line-opacity": 0.18 },
          });
          map.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            layout,
            paint: { "line-color": "#ffffff", "line-width": 9 },
          });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route",
            layout,
            paint: { "line-color": "#4338ca", "line-width": 5 },
          });
        }
      } catch {
        return; // the map style is switching; it redraws itself when ready
      }

      destMarker?.remove();
      destMarker = null;
      if (!r) return;

      destMarker = new mapboxgl.Marker({ element: pinEl(), anchor: "bottom" }).setLngLat(r.to).addTo(map);

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
      delete rots[id];
      delete lastPos[id];
      delete lastSeen[id];
      delete latest[id];
      delete assignedFlag[id];
      delete anims[id];
      setCount(Object.keys(latest).length);
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        const ll: LL = [pos.coords.longitude, pos.coords.latitude];
        meRef.current = ll;
        if (!markers["me"]) {
          markers["me"] = new mapboxgl.Marker({ element: meEl() }).setLngLat(ll).addTo(map);
          if (!routeRef.current) map.flyTo({ center: ll, zoom: 14 });
        } else {
          markers["me"].setLngLat(ll);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );

    const draw = (d: Driver) => {
      if (cancelled || d.lat === null || d.lng === null) return;
      const isAssigned = d.id === assignedRef.current;
      const to: LL = [d.lng, d.lat];

      if (markers[d.id] && assignedFlag[d.id] !== isAssigned) {
        markers[d.id].remove();
        delete markers[d.id];
        delete rots[d.id];
        delete anims[d.id];
        delete lastPos[d.id];
      }

      if (!markers[d.id]) {
        const el = carEl(isAssigned);
        markers[d.id] = new mapboxgl.Marker({ element: el }).setLngLat(to).addTo(map);
        rots[d.id] = el.querySelector<HTMLElement>(".car-rot");
        assignedFlag[d.id] = isAssigned;
        lastPos[d.id] = to;
      } else {
        const prev = lastPos[d.id];
        if (prev && metersBetween(prev, to) > 6) {
          const r = rots[d.id];
          if (r) r.style.transform = `rotate(${bearing(prev, to)}deg)`;
        }
        if (!prev || metersBetween(prev, to) > 0.5) glide(d.id, to);
        lastPos[d.id] = to;
      }

      if (isAssigned && fitted !== d.id && !routeRef.current) {
        fitted = d.id;
        if (meRef.current) {
          const bounds = new mapboxgl.LngLatBounds().extend(meRef.current).extend(to);
          map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
        } else {
          map.flyTo({ center: to, zoom: 16 });
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
      setCount(Object.keys(latest).length);
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
      if (raf) cancelAnimationFrame(raf);
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

  const locate = () => {
    const m = mapRef.current;
    if (!m) return;
    const go = (ll: LL) => m.flyTo({ center: ll, zoom: Math.max(m.getZoom(), 16), duration: 900 });
    if (meRef.current) return go(meRef.current);
    navigator.geolocation.getCurrentPosition((p) => go([p.coords.longitude, p.coords.latitude]));
  };

    return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />

      {/* Hidden while driver guidance is running, because the guidance banner sits in the same spot */}
      {!route?.follow && (
        <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-center gap-2">
          {showCount && (
            <div className="inline-flex items-center gap-2 bg-white rounded-full shadow-lg px-3 h-11 text-xs font-bold text-gray-900">
              <span className="relative flex w-2 h-2">
                {count > 0 && <span className="live-ping absolute inline-flex w-full h-full rounded-full bg-emerald-500" />}
                <span className={`relative inline-flex w-2 h-2 rounded-full ${count > 0 ? "bg-emerald-500" : "bg-gray-400"}`} />
              </span>
              {count === 0 ? "None online" : `${count} online`}
            </div>
          )}
          <button
            onClick={locate}
            aria-label="Centre the map on my location"
            className="w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-indigo-700 active:scale-90 transition-transform"
          >
            <Icon name="locate" className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}