"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function UserChip({
  id,
  name,
  role,
  avatar,
  phone,
}: {
  id: string;
  name: string | null;
  role: string;
  avatar: string | null;
  phone: string | null;
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

  const first = (name || "User").split(" ")[0];
  const detail =
    role === "driver"
      ? rating
        ? `★ ${rating.avg.toFixed(1)} (${rating.count})`
        : "New driver"
      : role === "customer"
        ? phone ?? ""
        : "Admin";

  return (
    <Link
      href="/profile"
      aria-label="Open my profile"
      className="flex items-center gap-2 bg-white rounded-2xl shadow pl-1.5 pr-4 py-1.5 max-w-[62vw]"
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-indigo-200 shrink-0" />
      ) : (
        <span className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
          {first.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 leading-tight">
        <span className="block font-bold text-gray-900 truncate">{first}</span>
        <span className="block text-xs font-semibold text-indigo-700 truncate">
          <span className="capitalize">{role}</span>
          {detail ? ` · ${detail}` : ""}
        </span>
      </span>
    </Link>
  );
}