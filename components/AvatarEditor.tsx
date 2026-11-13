"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, Tile } from "@/components/AdminUI";
import { squareAvatar } from "@/lib/avatar";
import { toast } from "@/lib/toast";

export default function AvatarEditor({
  src,
  initial,
  busy,
  onFile,
  size = 112,
}: {
  src: string | null;
  initial: string;
  busy: boolean;
  onFile: (f: File) => void;
  size?: number;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [prev, setPrev] = useState<{ url: string; base: string | null } | null>(null);

  // Free the preview picture when this screen closes
  const prevRef = useRef(prev);
  useEffect(() => {
    prevRef.current = prev;
  });
  useEffect(
    () => () => {
      if (prevRef.current) URL.revokeObjectURL(prevRef.current.url);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // lets the same photo be chosen again
    if (!f) return;
    setWorking(true);
    try {
      const square = await squareAvatar(f);
      if (prev) URL.revokeObjectURL(prev.url);
      setPrev({ url: URL.createObjectURL(square), base: src });
      onFile(square);
    } catch {
      toast("Could not read that photo. Please try another one.", { tone: "warn" });
    } finally {
      setWorking(false);
    }
  };

  const shown = prev && prev.base === src ? prev.url : src;
  const loading = busy || working;

  return (
    <>
      <input ref={cam} type="file" accept="image/*" capture="user" className="hidden" onChange={handle} />
      <input ref={gal} type="file" accept="image/*" className="hidden" onChange={handle} />

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        aria-label="Change profile photo"
        className="relative block rounded-full active:scale-95 transition-transform disabled:opacity-90"
        style={{ width: size, height: size }}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Profile" className="block w-full h-full rounded-full object-cover border-4 border-white shadow-xl" />
        ) : (
          <span
            className="flex w-full h-full rounded-full items-center justify-center font-extrabold text-white border-4 border-white shadow-xl"
            style={{ background: "linear-gradient(135deg,#4338ca,#0e7490)", fontSize: size * 0.4 }}
          >
            {initial}
          </span>
        )}

        {loading && (
          <span className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center">
            <span className="w-7 h-7 rounded-full border-[3px] border-white/40 border-t-white animate-spin" />
          </span>
        )}

        {!loading && (
          <span className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-indigo-600 text-white border-[3px] border-white shadow-lg flex items-center justify-center">
            <Icon name="camera" className="w-4 h-4" size={16} />
          </span>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/55 page-fade"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Profile photo"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 pop-in"
            >
              <div className="h-1.5" style={{ background: "linear-gradient(90deg,#4338ca,#0e7490)" }} />
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Tile name="user" color="#4338ca" size="w-11 h-11" />
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold leading-tight">Profile photo</h2>
                    <p className="text-sm text-gray-700 mt-1">Pick a picture. We centre it for you.</p>
                  </div>
                </div>

                <div className="grid gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      cam.current?.click();
                    }}
                    className="flex items-center gap-3 rounded-2xl border-2 border-indigo-100 bg-white p-3 text-left active:scale-[0.98] active:bg-indigo-50"
                  >
                    <Tile name="camera" color="#6366f1" size="w-11 h-11" />
                    <span className="flex-1">
                      <span className="block font-bold">Take a photo</span>
                      <span className="block text-xs text-gray-700">Use your camera</span>
                    </span>
                    <Icon name="chevron" className="w-4 h-4 text-gray-700" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      gal.current?.click();
                    }}
                    className="flex items-center gap-3 rounded-2xl border-2 border-indigo-100 bg-white p-3 text-left active:scale-[0.98] active:bg-indigo-50"
                  >
                    <Tile name="image" color="#0ea5e9" size="w-11 h-11" />
                    <span className="flex-1">
                      <span className="block font-bold">Choose from gallery</span>
                      <span className="block text-xs text-gray-700">Pick a photo or a file</span>
                    </span>
                    <Icon name="chevron" className="w-4 h-4 text-gray-700" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full bg-white border-2 border-indigo-200 font-bold rounded-2xl p-3 active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}