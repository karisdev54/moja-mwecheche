"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { reverseGeocode, type LngLat, type Place } from "@/lib/mapbox";

const DEFAULT: LngLat = [36.8219, -1.2921];
const STREETS = "mapbox://styles/mapbox/streets-v12";
const DARK = "mapbox://styles/mapbox/dark-v11";
const SAT = "mapbox://styles/mapbox/satellite-streets-v12";

export default function MapPicker({
  start,
  onCancel,
  onPick,
}: {
  start?: LngLat;
  onCancel: () => void;
  onPick: (p: Place) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const prevSat = useRef(false);
  const [label, setLabel] = useState("Drag the map to place the pin");
  const [center, setCenter] = useState<LngLat>(start ?? DEFAULT);
  const [moving, setMoving] = useState(false);
  const [sat, setSat] = useState(false);

  useEffect(() => {
    if (!box.current || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;
    const dark = document.documentElement.dataset.theme === "dark";

    const map = new mapboxgl.Map({
      container: box.current,
      style: dark ? DARK : STREETS,
      center: start ?? DEFAULT,
      zoom: start ? 17 : 12,
    });
    mapRef.current = map;

    let alive = true;
    let seq = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const look = () => {
      const c = map.getCenter();
      const here: LngLat = [c.lng, c.lat];
      setCenter(here);
      setMoving(false);
      setLabel("Finding address...");
      const mine = ++seq;
      reverseGeocode(here[0], here[1]).then((t) => {
        if (alive && mine === seq) setLabel(t);
      });
    };

    map.on("movestart", () => setMoving(true));
    map.on("moveend", () => {
      clearTimeout(timer);
      timer = setTimeout(look, 250);
    });
    map.on("load", look);

    // No starting point? Open on where the person is
    if (!start) {
      navigator.geolocation.getCurrentPosition(
        (p) => map.jumpTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 16 }),
        () => {}
      );
    }

    return () => {
      alive = false;
      clearTimeout(timer);
      mapRef.current = null;
      map.remove();
    };
  }, [start]);

  // Satellite view makes it easier to spot the exact gate or building
  useEffect(() => {
    const m = mapRef.current;
    if (!m || prevSat.current === sat) return;
    prevSat.current = sat;
    const dark = document.documentElement.dataset.theme === "dark";
    m.setStyle(sat ? SAT : dark ? DARK : STREETS);
  }, [sat]);

  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      (p) => mapRef.current?.easeTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 17 }),
      () => setLabel("Turn on location to jump to where you are.")
    );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-white shadow">
        <button onClick={onCancel} className="font-semibold px-3 py-2">✕ Cancel</button>
        <p className="font-bold">Choose on map</p>
        <button
          onClick={() => setSat((s) => !s)}
          className="font-semibold px-3 py-2 rounded-lg border-2 border-indigo-200"
        >
          {sat ? "🗺️ Map" : "🛰️ Satellite"}
        </button>
      </div>

      <div className="relative flex-1">
        <div ref={box} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          <div className={`transition-transform duration-150 ${moving ? "-translate-y-3" : ""}`}>
            <svg width="40" height="52" viewBox="0 0 24 32" style={{ filter: "drop-shadow(0 3px 3px rgba(0,0,0,.35))" }}>
              <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z" fill="#dc2626" />
              <circle cx="12" cy="12" r="4.5" fill="#fff" />
            </svg>
          </div>
        </div>
        <button
          onClick={locate}
          aria-label="Jump to my location"
          className="absolute right-3 bottom-3 w-12 h-12 rounded-full bg-white shadow-lg text-xl"
        >
          🎯
        </button>
      </div>

      <div className="bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,.12)]">
        <p className="text-sm font-semibold">📍 {label}</p>
        <p className="text-xs text-gray-700">Zoom in and drag the map so the pin sits on the exact gate, door or stage.</p>
        <button
          onClick={() =>
            onPick({ name: label.split(",")[0].trim() || "Pinned location", address: label, coords: center })
          }
          disabled={label.startsWith("Finding")}
          className="w-full bg-indigo-600 text-white font-bold rounded-xl p-4 disabled:opacity-50"
        >
          Use this location
        </button>
      </div>
    </div>,
    document.body
  );
}