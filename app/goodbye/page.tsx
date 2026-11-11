
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";

function Goodbye() {
  const params = useSearchParams();

  const signedOut = params.get("out") === "1";
  const deleted = params.get("deleted") === "1";

  const [stuck, setStuck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    window.close();

    window.setTimeout(() => {
      setStuck(true);
    }, 400);
  };

  const logOutToo = async () => {
    setBusy(true);
    setError("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }

      window.location.replace("/goodbye?out=1");
    } catch {
      setError("Unable to sign out. Please try again.");
      setBusy(false);
    }
  };

  const heading = deleted
    ? "Account deleted"
    : signedOut
      ? "You are signed out"
      : "See you soon";

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center p-4 gap-5"
      style={{
        background: "linear-gradient(160deg, var(--bg), var(--surface))",
      }}
    >
      <Brand />

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 text-center space-y-4 text-gray-900 pop-in">

        <p className="text-5xl">
          {deleted ? "👋" : signedOut ? "🔒" : "👋"}
        </p>

        <h1 className="text-2xl font-extrabold">
          {heading}
        </h1>

        <p className="text-sm text-gray-600">
          {deleted
            ? "Your KEY AND GO account has been deleted. Thank you for using our service."
            : "Thank you for using KEY AND GO. Location sharing is off and nothing is running in the background."}

          {!signedOut && !deleted &&
            " You are still signed in, so opening the app again takes you straight in."}
        </p>

        {/* Close app */}
        <button
          onClick={close}
          className="w-full text-white font-bold rounded-xl p-4"
          style={{
            background: "linear-gradient(90deg,#4338ca,#0e7490)",
          }}
        >
          Close app
        </button>

        {/* Close instructions */}
        {stuck && (
          <p className="text-sm bg-indigo-50 border border-indigo-200 rounded-xl p-3">
            Your phone or browser may not allow apps to close themselves.
            Swipe this app away from your recent apps, or simply leave it.
          </p>
        )}

        {/* Sign out */}
        {!signedOut && !deleted && (
          <button
            onClick={logOutToo}
            disabled={busy}
            className="w-full border-2 border-indigo-200 text-indigo-700 font-bold rounded-xl p-3 hover:bg-indigo-50 disabled:opacity-60"
          >
            {busy ? "Signing out..." : "Sign out as well"}
          </button>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}

        {/* Home link */}
        <Link
          href="/"
          className="block text-sm font-semibold underline pt-2"
        >
          Back to home
        </Link>

      </div>
    </main>
  );
}

export default function GoodbyePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh flex items-center justify-center">
          <p className="text-sm text-gray-500">Loading...</p>
        </main>
      }
    >
      <Goodbye />
    </Suspense>
  );
}
