"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/AdminUI";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

async function reachable(): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`/icon-192.png?ping=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: ctl.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

const TIPS = [
  { icon: "device", text: "Check that Wi-Fi or mobile data is on" },
  { icon: "alert", text: "Turn airplane mode off" },
  { icon: "locate", text: "Move to a place with better signal" },
];

export default function OfflineGate() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const [unreachable, setUnreachable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stillDown, setStillDown] = useState(false);
  const fails = useRef(0);
  const probing = useRef(false);

  const down = !online || unreachable;

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (probing.current) return;
      probing.current = true;
      const ok = await reachable();
      probing.current = false;
      if (!active) return;
      if (ok) {
        fails.current = 0;
        setUnreachable(false);
      } else {
        fails.current += 1;
        if (fails.current >= 2) setUnreachable(true);
      }
    };

    // A request failed somewhere in the app: confirm straight away, no waiting
    const onDown = async () => {
      if (probing.current) return;
      probing.current = true;
      const ok = await reachable();
      probing.current = false;
      if (!active) return;
      if (!ok) {
        fails.current = 2;
        setUnreachable(true);
      }
    };

    const wake = () => {
      if (document.visibilityState === "visible") run();
    };

    run();
    const t = setInterval(run, down ? 4000 : 15000);
    window.addEventListener("net:down", onDown);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("net:down", onDown);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [down]);

  const tryAgain = async () => {
    setChecking(true);
    setStillDown(false);
    const ok = await reachable();
    setChecking(false);
    if (ok) {
      fails.current = 0;
      setUnreachable(false);
    } else {
      setStillDown(true);
    }
  };

  if (!down) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Network error"
      className="fixed inset-0 z-[200] flex items-center justify-center p-5 overflow-y-auto"
      style={{ background: "linear-gradient(160deg, var(--bg), var(--surface))" }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 pop-in">
        <div className="h-1.5" style={{ background: "linear-gradient(90deg,#dc2626,#f97316)" }} />
        <div className="p-6 text-center space-y-4">
          <div className="relative mx-auto w-20 h-20">
            <span className="pulse-ring absolute inset-0 rounded-full" style={{ background: "rgba(220,38,38,0.25)" }} />
            <span
              className="relative w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "color-mix(in srgb, #dc2626 14%, var(--surface))", color: "#dc2626" }}
            >
              <Icon name="device" className="w-9 h-9" size={36} />
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Network error</h1>
            <p className="text-sm text-gray-700 mt-1">
              {online
                ? "Your phone is connected, but we cannot reach our servers. Your signal may be weak, or our service may be down for a moment."
                : "You are offline. Your phone has no internet connection right now."}
            </p>
          </div>

          <ul className="text-left rounded-2xl bg-indigo-50 border border-indigo-100 p-3 space-y-2">
            {TIPS.map((t) => (
              <li key={t.text} className="flex items-center gap-2.5 text-sm">
                <span className="text-indigo-600">
                  <Icon name={t.icon} className="w-4 h-4" />
                </span>
                {t.text}
              </li>
            ))}
          </ul>

          {stillDown && <p className="slide-in text-sm font-semibold text-red-600">Still no connection. Please try again.</p>}

          <div className="space-y-2">
            <button
              onClick={tryAgain}
              disabled={checking}
              className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-3.5 disabled:opacity-70 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {checking && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {checking ? "Checking..." : "Try again"}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-white border-2 border-indigo-200 font-bold rounded-2xl p-3 active:scale-[0.98]"
            >
              Reload the page
            </button>
          </div>

          <p className="text-xs text-gray-700 flex items-center justify-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-indigo-200 border-t-indigo-700 animate-spin" />
            Reconnecting automatically. What you were typing is kept.
          </p>
        </div>
      </div>
    </div>
  );
}