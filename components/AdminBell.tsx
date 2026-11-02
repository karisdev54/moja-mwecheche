"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export type Inbox = {
  drivers_pending: number;
  refunds_count: number;
  refunds_amount: number;
  reports_open: number;
  reports_safety: number;
  owed_total: number;
  owed_drivers: number;
  stuck_payments: number;
};

export const inboxTotal = (i: Inbox) =>
  i.drivers_pending + i.refunds_count + i.reports_open + i.owed_drivers + i.stuck_payments;

export default function AdminBell() {
  const [n, setN] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      supabase.rpc("admin_inbox").then(({ data }) => {
        if (active && data) setN(inboxTotal(data as Inbox));
      });
    load();
    const t = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return (
    <Link
      href="/admin/notifications"
      aria-label={`Notifications, ${n} waiting`}
      className="relative bg-white rounded-xl shadow w-12 h-12 flex items-center justify-center text-xl"
    >
      🔔
      {n > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}