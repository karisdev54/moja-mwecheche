"use client";
import { useEffect, useRef, useState } from "react";

const OUT = 512; // saved picture size in pixels

export default function AvatarCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (f: File) => void;
}) {
  const [bmp, setBmp] = useState<ImageBitmap | null>(null);
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  // Size of the square crop area, fitted to small phone screens
  const [V] = useState(() => Math.min(320, (typeof window !== "undefined" ? window.innerWidth : 360) - 48));
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Load the chosen photo
  useEffect(() => {
    let active = true;
    createImageBitmap(file)
      .then((b) => {
        if (active) setBmp(b);
      })
      .catch(() => {
        if (active) setErr("Could not open that photo. Please try another one.");
      });
    return () => {
      active = false;
    };
  }, [file]);

  // Free the memory used by the previous photo
  useEffect(() => {
    return () => {
      bmp?.close();
    };
  }, [bmp]);

  // Scale that makes the photo just cover the crop area, times the zoom
  const scaleFor = (b: ImageBitmap, z: number) => (V / Math.min(b.width, b.height)) * z;

  // Keeps the photo from being dragged off the crop area
  const clamp = (o: { x: number; y: number }, z: number) => {
    if (!bmp) return o;
    const s = scaleFor(bmp, z);
    const mx = Math.max(0, (bmp.width * s - V) / 2);
    const my = Math.max(0, (bmp.height * s - V) / 2);
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) };
  };

  // Draw the preview
  useEffect(() => {
    const c = canvas.current;
    if (!c || !bmp) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = V * dpr;
    c.height = V * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, V, V);
    const s = (V / Math.min(bmp.width, bmp.height)) * zoom;
    const w = bmp.width * s;
    const h = bmp.height * s;
    ctx.drawImage(bmp, V / 2 - w / 2 + off.x, V / 2 - h / 2 + off.y, w, h);
  }, [bmp, zoom, off, V]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    setOff(clamp({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) }, zoom));
  };
  const onUp = () => {
    drag.current = null;
  };

  const changeZoom = (z: number) => {
    setZoom(z);
    setOff((o) => clamp(o, z));
  };

  const reset = () => {
    setZoom(1);
    setOff({ x: 0, y: 0 });
  };

  const save = () => {
    if (!bmp) return;
    setBusy(true);
    const s = scaleFor(bmp, zoom);
    const w = bmp.width * s;
    const h = bmp.height * s;
    // The part of the original photo that sits inside the crop area
    const sx = (w / 2 - V / 2 - off.x) / s;
    const sy = (h / 2 - V / 2 - off.y) / s;
    const out = document.createElement("canvas");
    out.width = OUT;
    out.height = OUT;
    const ctx = out.getContext("2d");
    if (!ctx) {
      setBusy(false);
      setErr("Could not process the photo.");
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.drawImage(bmp, sx, sy, V / s, V / s, 0, 0, OUT, OUT);
    out.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) {
          setErr("Could not process the photo.");
          return;
        }
        onDone(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-4 space-y-3 text-gray-900" style={{ width: V + 32 }}>
        <p className="text-center font-bold">Adjust your picture</p>

        {err && <p className="text-red-600 text-sm text-center">{err}</p>}

        {!err && (
          <div
            className="relative overflow-hidden rounded-xl bg-gray-200 mx-auto touch-none select-none cursor-grab"
            style={{ width: V, height: V }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {!bmp && <p className="absolute inset-0 flex items-center justify-center text-sm">Loading...</p>}
            <canvas ref={canvas} style={{ width: V, height: V }} />
            {/* Circle shows what will be kept; the dark area is cut off */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)", border: "2px solid white" }}
            />
          </div>
        )}

        {!err && (
          <>
            <p className="text-xs text-center text-gray-700">Drag to move. Use the slider to zoom.</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">−</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => changeZoom(Number(e.target.value))}
                className="flex-1"
                aria-label="Zoom"
              />
              <span className="text-lg font-bold">+</span>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button onClick={onCancel} disabled={busy} className="flex-1 bg-white border-2 border-indigo-200 font-semibold rounded-lg p-3">
            Cancel
          </button>
          {!err && (
            <button onClick={reset} disabled={busy} className="bg-white border-2 border-indigo-200 font-semibold rounded-lg p-3 px-4">
              Reset
            </button>
          )}
          {!err && (
            <button
              onClick={save}
              disabled={!bmp || busy}
              className="flex-1 bg-indigo-600 text-white font-bold rounded-lg p-3 disabled:opacity-50"
            >
              {busy ? "..." : "Use photo"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}