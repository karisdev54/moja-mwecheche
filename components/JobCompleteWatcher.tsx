"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 9) * 0.15,
  dur: 2.4 + (i % 5) * 0.35,
  dx: ((i * 53) % 120) - 60,
  color: COLORS[i % COLORS.length],
}));

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

  if (!job) return null;

  const close = () => {
    markSeen(job.id);
    setJob(null);
    fetchUnseen(userId, role).then((j) => setJob(j));
  };

  const isDriver = role === "driver";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5 bg-black/60 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              "--dx": `${p.dx}px`,
            } as React.CSSProperties
          }
        />
      ))}

      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center space-y-3 text-gray-900 pop-in">
        <div className="relative mx-auto w-20 h-20">
          <span className="pulse-ring absolute inset-0 rounded-full bg-green-400/50" />
          <svg viewBox="0 0 52 52" className="relative w-20 h-20">
            <circle className="check-circle" cx="26" cy="26" r="25" fill="none" stroke="#16a34a" strokeWidth="3" />
            <path className="check-tick" d="M14 27l8 8 16-16" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="text-2xl font-extrabold">{isDriver ? "Great job! 🎉" : "Job complete! 🎉"}</h2>
        <p className="font-semibold">
          {isDriver ? "Thank you for driving with KEY AND GO." : "Thank you for choosing KEY AND GO."}
        </p>
        <p className="text-sm text-gray-700">
          {isDriver
            ? `Your ${job.task_type} job is done.`
            : `Your ${job.task_type} is done. We hope it went smoothly.`}
        </p>

        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-3 text-sm">
          {isDriver ? (
            <>
              <p className="text-gray-700">You earned</p>
              <p className="text-2xl font-extrabold text-indigo-800">
                KES {Math.round(Number(job.driver_earnings ?? 0)).toLocaleString()}
              </p>
              <p className="text-xs text-gray-700">After our commission. Paid out to your M-Pesa.</p>
            </>
          ) : (
            <>
              <p className="text-gray-700">Total paid</p>
              <p className="text-2xl font-extrabold text-indigo-800">KES {Math.round(job.price).toLocaleString()}</p>
              <p className="text-xs text-gray-700">{job.duration_hours} hour{job.duration_hours === 1 ? "" : "s"}</p>
            </>
          )}
        </div>

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
        <button onClick={close} className="w-full bg-white border-2 border-indigo-200 font-semibold rounded-xl p-3">
          {isDriver ? "Back to the map" : "Maybe later"}
        </button>
      </div>
    </div>
  );
}