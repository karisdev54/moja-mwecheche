"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import { Icon } from "@/components/AdminUI";

function Goodbye() {
  const params = useSearchParams();
  const deleted = params.get("deleted") === "1";
  const signedOut = params.get("out") === "1" || deleted;
  const wasDriver = params.get("d") === "1";
  const [stuck, setStuck] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    window.close();
    setTimeout(() => setStuck(true), 400); // still here: the phone does not allow apps to close themselves
  };

  const signOutToo = async () => {
    setBusy(true);
    await supabase.auth.signOut();
    window.location.replace(`/goodbye?out=1&d=${wasDriver ? 1 : 0}`);
  };

  const title = deleted ? "Account deleted" : signedOut ? "You are signed out" : "You have exited the app";
  const lead = deleted
    ? "Your account and personal details have been removed."
    : signedOut
      ? "Thank you for using KEY AND GO."
      : "Thank you for using KEY AND GO. You can close this window now.";

  const points = [
    ...(wasDriver && !deleted ? ["You are offline and will not receive new jobs"] : []),
    "Location sharing is switched off",
    "Nothing is running in the background",
    deleted ? "Your session on this device has ended" : signedOut ? "Your session on this device has ended" : "You are still signed in on this device",
  ];

  return (
    <main className="min-h-dvh relative overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="aurora pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-sm px-4 min-h-dvh flex flex-col items-center justify-center gap-5 py-8">
        <Brand />

        <div className="w-full bg-white rounded-3xl shadow-xl overflow-hidden text-gray-900 pop-in">
          <div className="h-1.5 grad-bg" />
          <div className="p-6 space-y-5">
            <div className="text-center space-y-3">
              <span
                className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "color-mix(in srgb, #4338ca 14%, var(--surface))", color: "#4338ca" }}
              >
                <Icon name="power" className="w-7 h-7" size={28} />
              </span>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
                <p className="text-sm text-gray-700 mt-1">{lead}</p>
              </div>
            </div>

            <ul className="rounded-2xl bg-indigo-50 border border-indigo-100 p-3 space-y-2">
              {points.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-sm">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                    <Icon name="tick" className="w-3 h-3" size={12} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <button
                onClick={close}
                className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-3.5 shadow-lg active:scale-[0.98]"
              >
                Close app
              </button>

              {stuck && (
                <p className="slide-in text-sm rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                  Your phone does not let apps close themselves. Swipe this app away from your recent apps, or simply leave it.
                </p>
              )}

              {signedOut ? (
                <Link href={deleted ? "/" : "/login"} className="block text-center w-full bg-white border-2 border-indigo-200 font-bold rounded-2xl p-3 active:scale-[0.98]">
                  {deleted ? "Back to home" : "Log in again"}
                </Link>
              ) : (
                <>
                  <Link href="/dashboard" className="block text-center w-full bg-white border-2 border-indigo-200 font-bold rounded-2xl p-3 active:scale-[0.98]">
                    Open the app again
                  </Link>
                  <button
                    onClick={signOutToo}
                    disabled={busy}
                    className="w-full text-sm font-bold text-red-600 p-2 disabled:opacity-60"
                  >
                    {busy ? "Signing out..." : "Sign out as well"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function GoodbyePage() {
  return (
    <Suspense fallback={null}>
      <Goodbye />
    </Suspense>
  );
}