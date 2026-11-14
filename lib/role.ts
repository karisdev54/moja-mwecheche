"use client";
import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

let role: string | null = null;
let loading = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

async function load() {
  if (loading) return;
  loading = true;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) {
    role = null;
  } else {
    const { data } = await supabase.from("profiles").select("role").eq("id", s.session.user.id).maybeSingle();
    role = data?.role ?? null;
  }
  loading = false;
  emit();
}

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      role = null;
      emit();
    }
    if (event === "SIGNED_IN") {
      role = null;
      load();
    }
  });
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (role === null) load();
  return () => {
    subs.delete(cb);
  };
}

// The signed-in person's role, or null while it loads or when signed out
export function useRole(): string | null {
  return useSyncExternalStore(subscribe, () => role, () => null);
}