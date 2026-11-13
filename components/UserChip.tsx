"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/AdminUI";

const TONE: Record<string, string> = { driver: "#6366f1", customer: "#0ea5e9", admin: "#8b5cf6" };
const LABEL: Record<string, string> = { driver: "Driver", customer: "Customer", admin: "Administrator" };

export default function UserChip({
  id,
  name,
  role,
  avatar,
}: {
  id: string;
  name: string | null;
  role: string;
  avatar: string | null;
  phone?: string | null; // accepted so older callers still compile, but never shown
}) {
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);

  useEffect(() => {
    if (role !== "driver") return;
    let active = true;
    supabase
      .from("driver_ratings")
      .select("avg_rating,rating_count")
      .eq("driver_id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setRating({ avg: Number(data.avg_rating), count: data.rating_count });
      });
    return () => {
      active = false;
    };
  }, [id, role]);

  const first = (name ?? "").trim().split(/\s+/)[0] || "User";
  const color = TONE[role] ?? "#6366f1";

  return (
    <Link
      href="/profile"
      aria-label="Open my profile"
      className="flex items-center gap-2.5 bg-white rounded-full shadow-lg h-12 pl-1 pr-4 max-w-[58vw] active:scale-95 transition-transform"
    >
      <span className="rounded-full p-[2px] shrink-0" style={{ background: color }}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="block w-10 h-10 rounded-full object-cover border-2 border-white" />
        ) : (
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center text-base font-extrabold text-white border-2 border-white"
            style={{ background: color }}
          >
            {first.charAt(0).toUpperCase()}
          </span>
        )}
      </span>

      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-bold text-gray-900 truncate">{first}</span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-700">
          {role === "driver" ? (
            rating ? (
              <>
                <span className="text-amber-500">
                  <Icon name="star" className="w-3 h-3" size={12} />
                </span>
                <span>{rating.avg.toFixed(1)}</span>
                <span className="text-gray-700/70">({rating.count})</span>
              </>
            ) : (
              <span>New driver</span>
            )
          ) : (
            <span>{LABEL[role] ?? role}</span>
          )}
        </span>
      </span>
    </Link>
  );
}