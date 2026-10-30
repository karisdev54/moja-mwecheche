"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Is the app already running as an installed app?
function subscribeStandalone(cb: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function getStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function getIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
const noSubscribe = () => () => {};

export default function InstallButton() {
  const standalone = useSyncExternalStore(subscribeStandalone, getStandalone, () => false);
  const ios = useSyncExternalStore(noSubscribe, getIOS, () => false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the event so our own button can use it
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone) return null; // already installed, nothing to show

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } else {
      setHelp((h) => !h);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3 text-gray-900">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl">📲</div>
        <div className="flex-1">
          <p className="font-bold">Install the app</p>
          <p className="text-sm text-gray-700">Open it from your home screen, full screen, like any app.</p>
        </div>
      </div>

      <button onClick={install} className="w-full bg-indigo-600 text-white font-bold rounded-lg p-3">
        {prompt ? "Install now" : "How to install"}
      </button>

      {help && !prompt && (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-3 text-sm space-y-1">
          {ios ? (
            <>
              <p className="font-semibold">On iPhone (use Safari):</p>
              <p>1. Tap the Share button (the square with an arrow).</p>
              <p>2. Scroll down and tap <b>Add to Home Screen</b>.</p>
              <p>3. Tap <b>Add</b>.</p>
            </>
          ) : (
            <>
              <p className="font-semibold">On Android (use Chrome):</p>
              <p>1. Tap the menu (⋮) at the top right.</p>
              <p>2. Tap <b>Install app</b> or <b>Add to Home screen</b>.</p>
              <p>3. Tap <b>Install</b>.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}