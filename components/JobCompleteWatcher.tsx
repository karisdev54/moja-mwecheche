"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { exitApp } from "@/lib/exit";

type Done = {
  id: string;
  task_type: string;
  price: number;
  driver_earnings: number | null;
  duration_hours: number;
  destination: string | null;
};

const KEY = "seen-complete";
const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#22c55e", "#a855f7"];
const PIECES = Array.from({ length: 32 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 9) * 0.15,
  dur: 2.6 + (i % 5) * 0.35,
  dx: ((i * 53) % 120) - 60,
  color: COLORS[i % COLORS.length],
  round: i % 3 === 0,
}));
const STARS = [
  { x: 10, y: 20, d: 0 },
  { x: 86, y: 16, d: 0.4 },
  { x: 20, y: 66, d: 0.8 },
  { x: 80, y: 60, d: 1.2 },
  { x: 50, y: 10, d: 0.6 },
];

function seenList(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function markSeen(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...seenList().filter((x) => x !== id)].slice(0, 50)));
  } catch {
    // storage blocked: the card may show again, which is harmless
  }
}

async function fetchUnseen(userId: string, role: string): Promise<Done | null> {
  const col = role === "driver" ? "driver_id" : "customer_id";
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("bookings")
    .select("id,task_type,price,driver_earnings,duration_hours,destination")
    .eq(col, userId)
    .eq("status", "completed")
    .gte("completed_at", since)
    .order("completed_at", { ascending: false })
    .limit(5);
  const seen = seenList();
  return ((data ?? []) as Done[]).find((r) => !seen.includes(r.id)) ?? null;
}

export default function JobCompleteWatcher({ userId, role }: { userId: string; role: "customer" | "driver" }) {
  const [job, setJob] = useState<Done | null>(null);

  useEffect(() => {
    let active = true;
    const col = role === "driver" ? "driver_id" : "customer_id";

    const check = () => {
      fetchUnseen(userId, role).then((j) => {
        if (active) setJob((cur) => cur ?? j);
      });
    };
    check();

    const channel = supabase
      .channel("job-complete")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `${col}=eq.${userId}` },
        check
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId, role]);

  if (!job || typeof document === "undefined") return null;

  const close = () => {
    markSeen(job.id);
    setJob(null);
    fetchUnseen(userId, role).then((j) => setJob(j));
  };

  const isDriver = role === "driver";
  const amount = isDriver ? Number(job.driver_earnings ?? 0) : Number(job.price);

  // Drawn straight onto the page, so nothing around it can push it off-centre
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Job complete"
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/60 backdrop-blur-sm px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti pointer-events-none"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              borderRadius: p.round ? "9999px" : undefined,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              "--dx": `${p.dx}px`,
            } as React.CSSProperties
          }
        />
      ))}

      <div
        className="relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[2rem] shadow-2xl pop-in"
        style={{ background: "var(--surface)", color: "var(--fg)" }}
      >
        {/* Header: gradient, twinkling stars, a check badge and a curved bottom edge */}
        <div
          className="relative h-44 overflow-hidden"
          style={{ background: "linear-gradient(135deg,#4338ca 0%,#6366f1 45%,#0e7490 100%)" }}
        >
          {STARS.map((s, i) => (
            <span
              key={i}
              className="twinkle absolute text-white text-lg select-none"
              style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }}
            >
              ✦
            </span>
          ))}

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[58%] w-24 h-24">
            <span className="pulse-ring absolute inset-0 rounded-full bg-white/50" />
            <span className="pulse-ring absolute inset-0 rounded-full bg-white/30" style={{ animationDelay: "1.2s" }} />
            <div className="relative w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center">
              <svg viewBox="0 0 52 52" className="w-16 h-16">
                <circle className="check-circle" cx="26" cy="26" r="25" fill="none" stroke="#16a34a" strokeWidth="3" />
                <path
                  className="check-tick"
                  d="M14 27l8 8 16-16"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <svg
            viewBox="0 0 400 40"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 w-full h-8"
            aria-hidden="true"
          >
            <path d="M0 40 L0 22 Q100 0 200 22 T400 22 L400 40 Z" fill="var(--surface)" />
          </svg>
        </div>

        <div className="px-6 pb-6 pt-1 text-center space-y-3">
          <h2 className="text-2xl font-extrabold" style={{ color: "var(--heading)" }}>
            {isDriver ? "Great job! 🎉" : "Job complete! 🎉"}
          </h2>
          <p className="font-semibold">
            {isDriver ? "Thank you for driving with KEY AND GO." : "Thank you for choosing KEY AND GO."}
          </p>
          <p className="text-sm">
            {isDriver
              ? `Your ${job.task_type} job is done.`
              : `Your ${job.task_type} is done. We hope it went smoothly.`}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs">{isDriver ? "You earned" : "Total paid"}</p>
              <p className="text-xl font-extrabold text-indigo-800">KES {Math.round(amount).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs">Duration</p>
              <p className="text-xl font-extrabold text-indigo-800">
                {job.duration_hours} h
              </p>
            </div>
          </div>

          {job.destination && <p className="text-xs">📍 {job.destination}</p>}
          {isDriver && <p className="text-xs">After our commission. Paid out to your M-Pesa.</p>}

          <div className="space-y-2 pt-1">
            {!isDriver && (
              <Link
                href="/activity"
                onClick={() => markSeen(job.id)}
                className="block text-white font-bold rounded-xl p-3"
                style={{ background: "linear-gradient(90deg,#4338ca,#0e7490)" }}
              >
                ⭐ Rate your driver
              </Link>
            )}
            <button
              onClick={close}
              className="w-full bg-white border-2 border-indigo-200 font-semibold rounded-xl p-3"
            >
              {isDriver ? "Back to the map" : "Maybe later"}
            </button>
            <button
              onClick={() => {
                markSeen(job.id);
                exitApp();
              }}
              className="w-full text-sm font-semibold underline"
            >
              ⏻ Done, close the app
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}