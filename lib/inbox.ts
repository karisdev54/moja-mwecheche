"use client";
import { useSyncExternalStore } from "react";
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
  cars_pending: number;
};

export const inboxTotal = (i: Inbox) =>
 i.drivers_pending + i.cars_pending + i.refunds_count + i.reports_open + i.owed_drivers + i.stuck_payments;

// One shared copy of the data and one timer, however many components use it
let state: Inbox | null = null;
let notAdmin = false;
let timer: ReturnType<typeof setInterval> | undefined;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function load() {
  if (notAdmin) return;
  supabase.rpc("admin_inbox").then(({ data, error }) => {
    if (error) return; // a network hiccup: try again later
    if (data) {
      state = data as Inbox;
      emit();
    } else {
      state = null;
      notAdmin = true; // a customer or driver: nothing to watch
      stop();
      emit();
    }
  });
}

function start() {
  if (timer || notAdmin) return;
  load();
  timer = setInterval(load, 30000);
  window.addEventListener("focus", load);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = undefined;
  window.removeEventListener("focus", load);
}

function subscribe(cb: () => void) {
  subs.add(cb);
  start();
  return () => {
    subs.delete(cb);
    if (subs.size === 0) stop();
  };
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      state = null;
      notAdmin = false;
      emit();
    }
    if (event === "SIGNED_IN") {
      notAdmin = false;
      if (subs.size > 0) {
        start();
        load();
      }
    }
  });
}

// Work waiting for the admin. Null for everyone else.
export function useInbox(): Inbox | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}