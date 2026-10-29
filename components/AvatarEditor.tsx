"use client";
import { useRef, useState } from "react";
import AvatarCropper from "@/components/AvatarCropper";

export default function AvatarEditor({
  src,
  initial,
  busy = false,
  onFile,
  size = 88,
}: {
  src: string | null;
  initial: string;
  busy?: boolean;
  onFile: (f: File) => void;
  size?: number;
}) {
  const [menu, setMenu] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // lets the same photo be chosen again
    if (f) setCropFile(f); // crop first, then upload
  };

  const choose = (ref: React.RefObject<HTMLInputElement | null>) => {
    setMenu(false);
    ref.current?.click();
  };

  return (
    <>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Profile"
            className="w-full h-full rounded-full object-cover border-2 border-indigo-200"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold">
            {initial}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 rounded-full bg-black/50 text-white text-xs font-semibold flex items-center justify-center">
            Saving...
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenu(true)}
          disabled={busy}
          aria-label="Change profile picture"
          className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-indigo-600 border-2 border-white text-white flex items-center justify-center shadow disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
      </div>

      <input ref={cam} type="file" accept="image/*" capture="user" className="hidden" onChange={handle} />
      <input ref={gal} type="file" accept="image/*" className="hidden" onChange={handle} />

      {menu && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={() => setMenu(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center font-bold text-gray-900 pb-1">Profile picture</p>
            <button
              type="button"
              onClick={() => choose(cam)}
              className="w-full bg-indigo-600 text-white font-semibold rounded-xl p-4"
            >
              📷 Take photo
            </button>
            <button
              type="button"
              onClick={() => choose(gal)}
              className="w-full bg-white border-2 border-indigo-300 text-gray-900 font-semibold rounded-xl p-4"
            >
              🖼️ Choose from gallery
            </button>
            <button
              type="button"
              onClick={() => setMenu(false)}
              className="w-full text-gray-900 font-semibold rounded-xl p-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {cropFile && (
        <AvatarCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onDone={(f) => {
            setCropFile(null);
            onFile(f);
          }}
        />
      )}
    </>
  );
}