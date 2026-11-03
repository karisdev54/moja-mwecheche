"use client";
import { useEffect, useState } from "react";
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

// Work waiting for the admin. Returns null for everyone else.
export function useInbox(): Inbox | null {
  const [inbox, setInbox] = useState<Inbox | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      supabase.rpc("admin_inbox").then(({ data }) => {
        if (active) setInbox((data as Inbox | null) ?? null);
      });
    load();
    const t = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("focus", load);
    };
  }, []);

  return inbox;
}