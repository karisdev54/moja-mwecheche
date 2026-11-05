"use client";
import { useState } from "react";
import { motion } from "motion/react";

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
        className="w-full flex items-center justify-between px-4 py-3 grad-bg text-white"
      >
        <span className="font-bold">{title}</span>
        <span className="flex items-center gap-2 text-sm">
          {open ? "Hide" : "Show"}
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="inline-block">
            ▲
          </motion.span>
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.28, ease: "easeInOut" }}
        style={{ overflow: "hidden" }}
        inert={!open}
      >
        <div className="p-3 space-y-3 max-h-[50dvh] overflow-y-auto">{children}</div>
      </motion.div>
    </div>
  );
}