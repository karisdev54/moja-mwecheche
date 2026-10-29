"use client";
import { useRef } from "react";

export default function PhotoPicker({
  onFile,
  allowPdf = false,
  facing = "environment",
  disabled = false,
}: {
  onFile: (f: File) => void;
  allowPdf?: boolean;
  facing?: "user" | "environment";
  disabled?: boolean;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // lets the same photo be chosen again
    if (f) onFile(f);
  };

  return (
    <div className="flex gap-2">
      <input ref={cam} type="file" accept="image/*" capture={facing} className="hidden" onChange={handle} />
      <input
        ref={gal}
        type="file"
        accept={allowPdf ? "image/*,application/pdf" : "image/*"}
        className="hidden"
        onChange={handle}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => cam.current?.click()}
        className="flex-1 bg-indigo-600 text-white font-semibold rounded-lg p-3 disabled:opacity-50"
      >
        📷 Take photo
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => gal.current?.click()}
        className="flex-1 bg-white border-2 border-indigo-300 font-semibold rounded-lg p-3 disabled:opacity-50"
      >
        🖼️ {allowPdf ? "Gallery or file" : "Gallery"}
      </button>
    </div>
  );
}