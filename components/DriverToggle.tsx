"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const SEND_EVERY_MS = 4000; // max one database write per 4 seconds while moving
const HEARTBEAT_MS = 15000; // resend last position when standing still

type Pos = { lat: number; lng: number };

export default function DriverToggle({
  driverId,
  onOnlineChange,
}: {
  driverId: string;
  onOnlineChange?: (online: boolean) => void;
}) {
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const lastPos = useRef<Pos | null>(null);
  const lastSent = useRef(0);

  // Keeps the latest callback without restarting the tracking effect
  const cbRef = useRef(onOnlineChange);
  useEffect(() => {
    cbRef.current = onOnlineChange;
  });

  // Make sure the driver starts offline when the page loads
  useEffect(() => {
    supabase.from("drivers").update({ is_available: false }).eq("id", driverId).then(() => {});
  }, [driverId]);

  useEffect(() => {
    if (!online) return;

    let cancelled = false;
    let wakeLock: WakeLockSentinel | null = null;

    const send = (p: Pos) => {
      lastSent.current = Date.now();
      supabase
        .from("drivers")
        .update({
          is_available: true,
          lat: p.lat,
          lng: p.lng,
          location_updated_at: new Date().toISOString(),
        })
        .eq("id", driverId)
        .then(({ error: e }) => {
          if (e) setError(e.message);
        });
    };

    // Keep the screen on so tracking is not paused (best effort)
    const requestWakeLock = () => {
      navigator.wakeLock
        ?.request("screen")
        .then((l) => {
          if (cancelled) {
            l.release().catch(() => {});
          } else {
            wakeLock = l;
          }
        })
        .catch(() => {});
    };
    requestWakeLock();

    // Browsers drop the wake lock when the tab is hidden, so ask again when it returns
    const onVisible = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVisible);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setError("");
        lastPos.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (Date.now() - lastSent.current >= SEND_EVERY_MS) send(lastPos.current);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked. Allow it in your browser settings, then try again."
            : "Could not get your location. Check that GPS is on."
        );
        setOnline(false);
        cbRef.current?.(false); // tell the jobs list we are offline again
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );

    // Heartbeat so a stationary driver does not look stale
    const heartbeat = setInterval(() => {
      if (lastPos.current && Date.now() - lastSent.current >= HEARTBEAT_MS) {
        send(lastPos.current);
      }
    }, HEARTBEAT_MS);

    // Best-effort: go offline when the tab is closed
    const goOffline = () => {
      supabase.from("drivers").update({ is_available: false }).eq("id", driverId).then(() => {});
    };
    window.addEventListener("pagehide", goOffline);

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
      wakeLock?.release().catch(() => {});
      lastPos.current = null;
      lastSent.current = 0;
      goOffline();
    };
  }, [online, driverId]);

  // The support check runs on the tap, not inside the effect
  const toggle = () => {
    setError("");
    if (!online && !("geolocation" in navigator)) {
      setError("This device does not support location.");
      return;
    }
    const next = !online;
    setOnline(next);
    onOnlineChange?.(next);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {error && (
        <p className="bg-white text-red-600 text-sm rounded-lg shadow px-3 py-2 max-w-xs text-center">
          {error}
        </p>
      )}
      <button
        onClick={toggle}
        className={`px-6 py-3 rounded-xl text-white font-semibold shadow ${
          online ? "bg-green-600" : "bg-gray-700"
        }`}
      >
        {online ? "You are online (tap to go offline)" : "Go online"}
      </button>
    </div>
  );
}