"use client";
import { useSyncExternalStore } from "react";
import { friendlyError } from "@/lib/net";

type Base = { title: string; message?: string; confirmText?: string; cancelText?: string; danger?: boolean };
export type PromptOpts = Base & {
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  initial?: string;
};

export type DialogReq =
  | ({ id: number; kind: "confirm"; resolve: (v: boolean) => void } & Base)
  | ({ id: number; kind: "alert"; resolve: () => void } & Base)
  | ({ id: number; kind: "prompt"; resolve: (v: string | null) => void } & PromptOpts);

let queue: DialogReq[] = [];
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

function push(req: DialogReq) {
  queue = [...queue, req];
  emit();
}

// Asks yes or no. Resolves true or false.
export const confirmDialog = (o: Base) =>
  new Promise<boolean>((resolve) => push({ id: nextId++, kind: "confirm", resolve, ...o }));

// Shows a message. Resolves when it is closed.
export const alertDialog = (o: Base | string) =>
  new Promise<void>((resolve) =>
    push({ id: nextId++, kind: "alert", resolve,...(typeof o === "string" ? { title: friendlyError(o) } : { ...o, message: o.message ? friendlyError(o.message) : o.message }) })
  );

// Asks for text. Resolves the text, or null if cancelled.
export const promptDialog = (o: PromptOpts) =>
  new Promise<string | null>((resolve) => push({ id: nextId++, kind: "prompt", resolve, ...o }));

export function finish(d: DialogReq, v: boolean | string | null) {
  queue = queue.filter((x) => x.id !== d.id);
  emit();
  if (d.kind === "confirm") d.resolve(v === true);
  else if (d.kind === "alert") d.resolve();
  else d.resolve(typeof v === "string" ? v : null);
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function useDialog(): DialogReq | null {
  return useSyncExternalStore(subscribe, () => queue[0] ?? null, () => null);
}