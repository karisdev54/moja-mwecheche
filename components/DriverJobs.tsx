"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Job = {
  id: string;
  driver_id: string | null;
  task_type: string;
  scheduled_at: string;
  duration_hours: number;
  destination: string | null;
  price: number;
  status: string;
  paid: boolean;
};

const NEXT: Record<string, { status: string; label: string }> = {
  accepted: { status: "in_progress", label: "Start job" },
  in_progress: { status: "completed", label: "Complete job" },
};

async function fetchOpenJobs(): Promise<Job[]> {
  const { data } = await supabase
    .from("bookings")
    .select("id,driver_id,task_type,scheduled_at,duration_hours,destination,price,status,paid")
    .in("status", ["requested", "accepted", "in_progress"])
    .order("scheduled_at", { ascending: true });
  return (data ?? []) as Job[];
}

export default function DriverJobs({ driverId }: { driverId: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [declined, setDeclined] = useState<string[]>([]);

  const reload = () => {
    fetchOpenJobs().then(setJobs);
  };

  useEffect(() => {
    let active = true;

    const refresh = () => {
      fetchOpenJobs().then((j) => {
        if (active) setJobs(j);
      });
    };

    refresh();

    const channel = supabase
      .channel("driver-jobs")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, refresh)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const accept = async (id: string) => {
    const { data } = await supabase
      .from("bookings")
      .update({ driver_id: driverId, status: "accepted" })
      .eq("id", id)
      .eq("status", "requested")
      .is("driver_id", null)
      .select();
    if (!data || data.length === 0) alert("Sorry, another driver took this job.");
    reload();
  };

  const advance = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status }).eq("id", id).eq("driver_id", driverId);
    reload();
  };

  const visible = jobs.filter(
    (j) => (j.status === "requested" && !declined.includes(j.id)) || j.driver_id === driverId
  );

  if (visible.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3 max-h-[45vh] overflow-y-auto">
      {visible.map((j) => (
        <div key={j.id} className="border rounded-lg p-3 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold">{j.task_type}</span>
            <span>KES {j.price}</span>
          </div>
          <p className="text-gray-500">
            {new Date(j.scheduled_at).toLocaleString()} · {j.duration_hours}h
            {j.destination ? ` · to ${j.destination}` : ""}
          </p>

          {j.status === "requested" ? (
            <div className="flex gap-2 mt-2">
              <button onClick={() => accept(j.id)} className="flex-1 bg-green-600 text-white rounded-lg p-2">Accept</button>
              <button onClick={() => setDeclined([...declined, j.id])} className="flex-1 border rounded-lg p-2">Decline</button>
            </div>
          ) : j.status === "accepted" && !j.paid ? (
            <p className="mt-2 text-xs text-gray-600 bg-gray-100 rounded-lg p-2">
              Waiting for the customer to pay. You can start once payment is received.
            </p>
          ) : (
            NEXT[j.status] && (
              <button onClick={() => advance(j.id, NEXT[j.status].status)} className="w-full mt-2 bg-black text-white rounded-lg p-2">
                {NEXT[j.status].label}
              </button>
            )
          )}
        </div>
      ))}
    </div>
  );
}