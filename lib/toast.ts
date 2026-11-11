"use client";
import { useSyncExternalStore } from "react";
import { friendlyError } from "@/lib/net";

export type Toast = { id: number; text: string; href?: string; tone: "info" | "warn" | "danger" | "ok"; ms: number };

const EMPTY: Toast[] = [];
let toasts: Toast[] = EMPTY;
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

// Shows a message that disappears by itself (default 3.5 seconds)

export function toast(raw: string, opts: {href?: string; tone?: Toast["tone"]; ms?: number} = {}) { 
  const text = friendlyError(raw);
  const id = nextId++;
  const ms = opts.ms ?? 3500;
  toasts = [...toasts, { id, text, href: opts.href, tone: opts.tone ?? "info", ms }].slice(-3);
  emit();
  setTimeout(() => dismiss(id), ms);
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
}