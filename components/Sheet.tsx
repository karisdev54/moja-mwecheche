"use client";
import { useState } from "react";

export default function Sheet({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-600 text-white"
      >
        <span className="font-bold">{title}</span>
        <span className="text-sm">{open ? "Hide ▼" : "Show ▲"}</span>
      </button>
      <div className={open ? "p-3 space-y-3 max-h-[50dvh] overflow-y-auto anim-rise" : "hidden"}>
        {children}
      </div>
    </div>
  );
}