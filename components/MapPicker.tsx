"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import PlaceSearch from "@/components/PlaceSearch";
import { reverseGeocode, type LngLat, type Place } from "@/lib/mapbox";

const DEFAULT: LngLat = [36.8219, -1.2921];
const MIN_ZOOM = 16;

const styleFor = (sat: boolean) =>
  sat
    ? "mapbox://styles/mapbox/satellite-streets-v12"
    : document.documentElement.dataset.theme === "dark"
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/streets-v12";

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
  const startRef = useRef(start);
  const prevSat = useRef(false);
  const noToken = !process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const [label, setLabel] = useState("Drag the map to place the pin");
  const [center, setCenter] = useState<LngLat>(start ?? DEFAULT);
  const [zoom, setZoom] = useState(start ? 17 : 12);
  const [moving, setMoving] = useState(false);
  const [sat, setSat] = useState(false);
  const [ready, setReady] = useState(false);
  const [mapErr, setMapErr] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || noToken) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

    const s0 = startRef.current;
    const map = new mapboxgl.Map({
      container: el,
      style: styleFor(false),
      center: s0 ?? DEFAULT,
      zoom: s0 ? 17 : 12,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");

    let alive = true;
    let seq = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const look = () => {
      const c = map.getCenter();
      const here: LngLat = [c.lng, c.lat];
      setCenter(here);
      setZoom(map.getZoom());
      setMoving(false);
      setLabel("Finding address...");
      const mine = ++seq;
      reverseGeocode(here[0], here[1]).then((t) => {
        if (alive && mine === seq) setLabel(t);
      });
    };

    // The map must always match the size of its box
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);

    map.on("movestart", () => setMoving(true));
    map.on("moveend", () => {
      clearTimeout(timer);
      timer = setTimeout(look, 250);
    });
    map.on("load", () => {
      map.resize();
      setReady(true);
      look();
    });
    map.on("error", (e) => {
      const m = String((e as { error?: { message?: string } }).error?.message ?? "");
      if (/401|403|token|access|unauthor|forbidden/i.test(m)) {
        setMapErr("The map could not load. The map key may be blocked for this website.");
      }
    });

    // No starting point? Open where the person is
    if (!s0) {
      navigator.geolocation.getCurrentPosition(
        (p) => map.jumpTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 16 }),
        () => {}
      );
    }

    return () => {
      alive = false;
      clearTimeout(timer);
      ro.disconnect();
      mapRef.current = null;
      map.remove();
    };
  }, [noToken]);

  // Satellite view (real aerial imagery) helps spot the exact gate or building
  useEffect(() => {
    const m = mapRef.current;
    if (!m || prevSat.current === sat) return;
    prevSat.current = sat;
    m.setStyle(styleFor(sat));
  }, [sat]);

  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      (p) => mapRef.current?.easeTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 17 }),
      () => setLabel("Turn on location to jump to where you are.")
    );

  if (typeof document === "undefined") return null;

  const tooFar = zoom < MIN_ZOOM;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="bg-white shadow p-3 pt-[max(0.75rem,env(safe-area-inset-top))] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button onClick={onCancel} className="font-semibold px-3 py-2">✕ Cancel</button>
          <p className="font-bold">Choose on map</p>
          <button
            onClick={() => setSat((s) => !s)}
            className="font-semibold px-3 py-2 rounded-lg border-2 border-indigo-200"
          >
            {sat ? "🗺️ Map" : "🛰️ Satellite"}
          </button>
        </div>
        <PlaceSearch
          value={q}
          picked={picked}
          near={center}
          onTextChange={(v) => {
            setQ(v);
            setPicked(false);
          }}
          onPick={(p) => {
            setQ(p.address);
            setPicked(true);
            mapRef.current?.flyTo({ center: p.coords, zoom: 17 });
          }}
        />
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={box} style={{ position: "absolute", inset: 0 }} />

        {!ready && !noToken && !mapErr && (
          <div className="absolute inset-0 skel !rounded-none pointer-events-none" />
        )}
        {(noToken || mapErr) && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center bg-white">
            <p className="font-semibold text-red-600">
              {noToken ? "The map key is missing in this deployment." : mapErr}
            </p>
          </div>
        )}

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
        <p className={`text-xs ${tooFar ? "text-red-600 font-semibold" : "text-gray-700"}`}>
          {tooFar
            ? "Zoom in to street level to place the pin exactly."
            : "Drag the map so the pin sits on the exact gate, door or stage."}
        </p>
        <button
          onClick={() =>
            onPick({ name: label.split(",")[0].trim() || "Pinned location", address: label, coords: center })
          }
          disabled={tooFar || label.startsWith("Finding")}
          className="w-full bg-indigo-600 text-white font-bold rounded-xl p-4 disabled:opacity-50"
        >
          Use this location
        </button>
      </div>
    </div>,
    document.body
  );
}