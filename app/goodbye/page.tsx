"use client";
import { useState } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";

export default function GoodbyePage() {
  const [stuck, setStuck] = useState(false);

  const close = () => {
    window.close();
    setTimeout(() => setStuck(true), 400); // still here: the phone does not allow apps to close themselves
  };

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center p-4 gap-5"
      style={{ background: "linear-gradient(160deg, var(--bg), var(--surface))" }}
    >
      <Brand />
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 text-center space-y-3 text-gray-900 pop-in">
        <p className="text-5xl">👋</p>
        <h1 className="text-2xl font-extrabold">You are signed out</h1>
        <p className="text-sm">
          Thank you for using KEY AND GO. Location sharing is off and nothing is running in the background.
        </p>

        <button
          onClick={close}
          className="w-full text-white font-bold rounded-xl p-4"
          style={{ background: "linear-gradient(90deg,#4338ca,#0e7490)" }}
        >
          Close app
        </button>

        {stuck && (
          <p className="text-sm bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3">
            Your phone does not let apps close themselves. Swipe this app away from your recent apps, or just leave
            it. You are already signed out.
          </p>
        )}

        <Link href="/" className="block text-sm font-semibold underline">Back to home</Link>
      </div>
    </main>
  );
}