"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Stats = { avg_rating: number; rating_count: number } | null;
type Review = { id: string; rating: number; comment: string | null };

async function fetchRatingInfo(driverId: string): Promise<{ stats: Stats; reviews: Review[] }> {
  const { data: s } = await supabase
    .from("driver_ratings")
    .select("avg_rating,rating_count")
    .eq("driver_id", driverId)
    .maybeSingle();
  const { data: r } = await supabase
    .from("reviews")
    .select("id,rating,comment")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false })
    .limit(3);
  return { stats: (s as Stats) ?? null, reviews: (r ?? []) as Review[] };
}

export default function DriverRating({ driverId }: { driverId: string }) {
  const [info, setInfo] = useState<{ stats: Stats; reviews: Review[] } | null>(null);

  useEffect(() => {
    let active = true;
    fetchRatingInfo(driverId).then((i) => {
      if (active) setInfo(i);
    });
    return () => {
      active = false;
    };
  }, [driverId]);

  if (!info) return null;

  return (
    <div className="bg-white rounded-2xl shadow p-3 text-sm">
      {info.stats ? (
        <p className="font-semibold text-gray-900">
          <span className="text-yellow-500 text-lg">★</span> {Number(info.stats.avg_rating).toFixed(1)}{" "}
          <span className="font-normal text-gray-700">
            ({info.stats.rating_count} {info.stats.rating_count === 1 ? "rating" : "ratings"})
          </span>
        </p>
      ) : (
        <p className="text-gray-700">No ratings yet. Complete jobs to build your reputation.</p>
      )}
      {info.reviews
        .filter((r) => r.comment)
        .map((r) => (
          <p key={r.id} className="mt-1 text-gray-800">
            {"★".repeat(r.rating)} “{r.comment}”
          </p>
        ))}
    </div>
  );
}