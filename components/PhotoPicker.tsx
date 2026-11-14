"use client";
import { useRef } from "react";
import { Icon } from "@/components/AdminUI";

export default function PhotoPicker({
  onFile,
  allowPdf = false,
  facing = "environment",
  disabled = false,
  change = false,
}: {
  onFile: (f: File) => void;
  allowPdf?: boolean;
  facing?: "user" | "environment";
  disabled?: boolean;
  change?: boolean; // a file is already chosen: show one "Change photo" button instead of two
}) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const accept = allowPdf ? "image/*,application/pdf" : "image/*";

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // lets the same photo be chosen again
    if (f) onFile(f);
  };

  if (change) {
    return (
      <>
        <input ref={gal} type="file" accept={accept} className="hidden" onChange={handle} />
        <button
          type="button"
          disabled={disabled}
          onClick={() => gal.current?.click()}
          className="w-full flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 font-bold rounded-xl p-3 disabled:opacity-50 active:scale-95"
        >
          <Icon name="image" className="w-5 h-5" />
          Change photo
        </button>
      </>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <input ref={cam} type="file" accept="image/*" capture={facing} className="hidden" onChange={handle} />
      <input ref={gal} type="file" accept={accept} className="hidden" onChange={handle} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => cam.current?.click()}
        className="btn-shine grad-bg flex items-center justify-center gap-2 text-white font-bold rounded-xl p-3 shadow disabled:opacity-50 active:scale-95"
      >
        <Icon name="camera" className="w-5 h-5" />
        Take photo
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => gal.current?.click()}
        className="flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 font-bold rounded-xl p-3 disabled:opacity-50 active:scale-95"
      >
        <Icon name="image" className="w-5 h-5" />
        {allowPdf ? "Gallery or file" : "Gallery"}
      </button>
    </div>
  );
}