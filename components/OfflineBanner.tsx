"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const [unreachable, setUnreachable] = useState(false);

  // Online but the server cannot be reached (weak signal, or the service is down)
  useEffect(() => {
    if (!online) return;
    let active = true;
    const ping = () => {
      fetch(`/icon-192.png?ping=${Date.now()}`, { method: "HEAD", cache: "no-store" })
        .then((r) => {
          if (active) setUnreachable(!r.ok);
        })
        .catch(() => {
          if (active) setUnreachable(true);
        });
    };
    ping();
    const t = setInterval(ping, 20000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [online]);

  if (online && !unreachable) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[90] bg-red-600 text-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-sm shadow-lg"
    >
      <p className="font-bold">{online ? "Can't reach our servers" : "You are offline"}</p>
      <p className="text-red-50">
        {online
          ? "Your signal may be weak, or our service may be down for a moment."
          : "No internet connection. Check that Wi-Fi or mobile data is on, that airplane mode is off, and that you have signal."}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 underline font-bold"
      >
        ↻ Reload page
      </button>
    </div>
  );
}