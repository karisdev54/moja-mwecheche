import { useSyncExternalStore } from "react";

export type Pref = "light" | "dark" | "system";
const KEY = "theme";

export function getPref(): Pref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(p: Pref): "light" | "dark" {
  if (p === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return p;
}

export function setPref(p: Pref) {
  try {
    if (p === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch {
    // storage blocked: the choice still applies until the page closes
  }
  document.documentElement.dataset.theme = resolve(p);
  window.dispatchEvent(new Event("themechange"));
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (getPref() === "system") {
      document.documentElement.dataset.theme = resolve("system");
      cb();
    }
  };
  mq.addEventListener("change", onSystem);
  window.addEventListener("themechange", cb);
  return () => {
    mq.removeEventListener("change", onSystem);
    window.removeEventListener("themechange", cb);
  };
}

// The theme that is actually showing right now
export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light"
  );
}

// What the person chose (light, dark or follow the phone)
export function useThemePref(): Pref {
  return useSyncExternalStore(subscribe, getPref, () => "system");
}