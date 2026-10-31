"use client";
import { useEffect, useRef, useState } from "react";
import { fmtMinutes, getRouteSteps, type LngLat, type RouteView } from "@/lib/mapbox";
import { createPortal } from "react-dom";

const REFRESH_MS = 10000;

type Info = {
  text: string;
  meters: number;
  type?: string;
  modifier?: string;
  km: number;
  minutes: number;
  arrived: boolean;
};

function arrow(type?: string, modifier?: string): string {
  if (type === "arrive") return "📍";
  if (type === "roundabout" || type === "rotary") return "⟳";
  switch (modifier) {
    case "left": return "←";
    case "right": return "→";
    case "slight left": return "↖";
    case "slight right": return "↗";
    case "sharp left": return "↙";
    case "sharp right": return "↘";
    case "uturn": return "↺";
    default: return "↑";
  }
}

function fmtDist(m: number): string {
  if (m < 30) return "Now";
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function Guidance({
  toLng,
  toLat,
  label,
  onRoute,
  onStop,
}: {
  toLng: number;
  toLat: number;
  label: string;
  onRoute?: (r: RouteView | null) => void;
  onStop: () => void;
}) {
  const [info, setInfo] = useState<Info | null>(null);
  const [msg, setMsg] = useState("");
  const [voice, setVoice] = useState(false);
  const voiceRef = useRef(false);
  const lastSpoken = useRef("");
  const routeCb = useRef(onRoute);

  useEffect(() => {
    routeCb.current = onRoute;
    voiceRef.current = voice;
  });

  // Clear the route line from the map when guidance ends
  useEffect(() => {
    const cb = onRoute;
    return () => cb?.(null);
  }, [onRoute]);

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    let lastAt = 0;
    const to: LngLat = [toLng, toLat];

    const refresh = async (from: LngLat) => {
      if (busy) return;
      busy = true;
      lastAt = Date.now();
      const r = await getRouteSteps(from, to);
      busy = false;
      if (cancelled) return;
      if (!r) {
        setMsg("Can't reach the directions service. Retrying...");
        return;
      }
      setMsg("");
      setInfo({
        text: r.instruction,
        meters: r.meters,
        type: r.type,
        modifier: r.modifier,
        km: r.km,
        minutes: r.minutes,
        arrived: r.km * 1000 < 40,
      });
      routeCb.current?.({ geometry: r.geometry, from, to, follow: true });

      if (voiceRef.current && r.instruction !== lastSpoken.current && "speechSynthesis" in window) {
        lastSpoken.current = r.instruction;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(r.instruction));
      }
    };

    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - lastAt < REFRESH_MS) return;
        refresh([p.coords.longitude, p.coords.latitude]);
      },
      () => setMsg("Turn on your GPS to get directions."),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(id);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [toLng, toLat]);

    if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+4.75rem)] z-40 max-w-md mx-auto rounded-2xl text-white shadow-2xl anim-rise"
      style={{ background: "linear-gradient(135deg,#312e81,#4338ca 55%,#0e7490)" }}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="text-4xl font-bold w-12 text-center">
          {info ? arrow(info.type, info.modifier) : "…"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold leading-snug">
            {info ? (info.arrived ? "You have arrived" : info.text) : "Finding your route..."}
          </p>
          {info && !info.arrived && (
            <p className="text-sm text-indigo-100">in {fmtDist(info.meters)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/20 px-4 py-2 text-xs">
        <span className="font-semibold">{label}</span>
        {info && (
          <span className="flex-1">
            · {info.km} km · {fmtMinutes(info.minutes)}
          </span>
        )}
        {!info && <span className="flex-1" />}
        <button
          onClick={() => setVoice((v) => !v)}
          className="rounded-lg bg-white/20 px-3 py-1.5 font-semibold"
          aria-label="Toggle voice directions"
        >
          {voice ? "🔊" : "🔇"}
        </button>
        <button onClick={onStop} className="rounded-lg bg-white/20 px-3 py-1.5 font-semibold">
          Stop
        </button>
      </div>
      {msg && <p className="px-4 pb-2 text-xs text-amber-200">{msg}</p>}
    </div>
 , document.body
  );
}