"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/AdminUI";

type Win = { kind: "driver" | "car"; stamp: string; needsCar: boolean };

const KEY = "seen-approvals";
const WEEK = 7 * 24 * 3600 * 1000;

// A backup memory on this device, in case the database is unreachable when the person presses Continue
function localSeen(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
}
function localRemember(id: string) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    localStorage.setItem(KEY, JSON.stringify([id, ...list.filter((x) => x !== id)].slice(0, 30)));
  } catch {
    // storage blocked
  }
}

const recent = (iso: string) => Date.now() - new Date(iso).getTime() < WEEK;
// Not acknowledged yet, or acknowledged before this approval happened
const unseen = (approved: string, seen: string | null) => !seen || new Date(seen).getTime() < new Date(approved).getTime();

async function find(userId: string, role: string): Promise<Win | null> {
  if (role === "driver") {
    const { data: d } = await supabase
      .from("drivers")
      .select("is_verified,approved_at,approval_seen_at")
      .eq("id", userId)
      .maybeSingle();
    if (d?.is_verified && d.approved_at && recent(d.approved_at) && unseen(d.approved_at, d.approval_seen_at)) {
      const { data: p } = await supabase.from("profiles").select("has_car,car_status").eq("id", userId).maybeSingle();
      return { kind: "driver", stamp: d.approved_at, needsCar: p?.has_car === true && p.car_status !== "approved" };
    }
  }

  const { data: c } = await supabase
    .from("profiles")
    .select("car_status,car_approved_at,car_approval_seen_at")
    .eq("id", userId)
    .maybeSingle();
  if (c?.car_status === "approved" && c.car_approved_at && recent(c.car_approved_at) && unseen(c.car_approved_at, c.car_approval_seen_at)) {
    return { kind: "car", stamp: c.car_approved_at, needsCar: false };
  }
  return null;
}

export default function ApprovalWatcher({ userId, role }: { userId: string; role: "customer" | "driver" }) {
  const [win, setWin] = useState<Win | null>(null);
  const dismissed = useRef<Set<string>>(new Set()); // never show the same approval twice in one session
  const running = useRef(false);
  const lastRun = useRef(0);

  useEffect(() => {
    let active = true;

    const check = async () => {
      // One check at a time, and not more than once every few seconds
      if (running.current || Date.now() - lastRun.current < 4000) return;
      running.current = true;
      lastRun.current = Date.now();
      const w = await find(userId, role);
      running.current = false;
      if (!active || !w) return;
      const id = `${w.kind}:${w.stamp}`;
      if (dismissed.current.has(id) || localSeen(id)) return;
      setWin((cur) => cur ?? w);
    };

    check();

    // Only an approval changes who we are, so listen to the driver's own row, but let check() ignore the noise
    const channel =
      role === "driver"
        ? supabase
            .channel("approval-watch")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drivers", filter: `id=eq.${userId}` }, check)
            .subscribe()
        : null;

    const timer = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", check);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, role]);

  if (!win || typeof document === "undefined") return null;

  const close = () => {
    const id = `${win.kind}:${win.stamp}`;
    dismissed.current.add(id);
    localRemember(id);
    setWin(null);
    void supabase.rpc("ack_approval", { p_kind: win.kind }); // remembered on the account, on every device
  };

  const isDriver = win.kind === "driver";
  const title = isDriver ? "You are approved" : "Your vehicle is verified";
  const text = isDriver
    ? "Your documents have been checked. You can now go online and start accepting jobs."
    : role === "driver"
      ? "The verified tick now shows next to your plate. You can accept jobs where you bring the car."
      : "The verified tick now shows next to your plate. You can now book a driver for your own car.";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/60 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="relative w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[2rem] bg-white shadow-2xl pop-in text-gray-900">
        <div className="relative h-40 overflow-hidden" style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 45%,#0e7490 100%)" }}>
          {[
            { x: 12, y: 24, d: 0 },
            { x: 84, y: 18, d: 0.5 },
            { x: 22, y: 70, d: 1 },
            { x: 78, y: 64, d: 0.3 },
          ].map((s, i) => (
            <span key={i} className="twinkle absolute text-white text-base select-none" style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` }}>
              ✦
            </span>
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[56%] w-24 h-24">
            <span className="pulse-ring absolute inset-0 rounded-full bg-white/50" />
            <span className="pulse-ring absolute inset-0 rounded-full bg-white/30" style={{ animationDelay: "1.2s" }} />
            <div className="relative w-24 h-24 rounded-full bg-white shadow-xl flex items-center justify-center">
              <svg viewBox="0 0 52 52" className="w-16 h-16">
                <circle className="check-circle" cx="26" cy="26" r="25" fill="none" stroke="#16a34a" strokeWidth="3" />
                <path className="check-tick" d="M14 27l8 8 16-16" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-8" aria-hidden="true">
            <path d="M0 40 L0 22 Q100 0 200 22 T400 22 L400 40 Z" fill="#ffffff" />
          </svg>
        </div>

        <div className="px-6 pb-6 pt-1 text-center space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
            <p className="text-sm text-gray-700">{text}</p>
          </div>

          {isDriver && win.needsCar && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 p-3 text-left text-sm">
              <span className="text-indigo-600 mt-0.5">
                <Icon name="car" className="w-4 h-4" />
              </span>
              <p>
                To take jobs where you bring your own car, verify your vehicle next. Jobs where you drive the customer&apos;s car are open to you now.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <button onClick={close} className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-3.5 shadow-lg active:scale-[0.98]">
              Continue
            </button>
            {isDriver && win.needsCar && (
              <Link href="/profile/car" onClick={close} className="block w-full bg-white border-2 border-indigo-200 font-bold rounded-2xl p-3 active:scale-[0.98]">
                Verify my vehicle
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}