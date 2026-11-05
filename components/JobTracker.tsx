"use client";
import { motion } from "motion/react";

const STEPS = ["Requested", "Accepted", "Paid", "In progress", "Done"];

export function stepOf(status: string, paid: boolean): number | null {
  if (status === "requested") return 0;
  if (status === "accepted") return paid ? 2 : 1;
  if (status === "in_progress") return 3;
  if (status === "completed") return 4;
  return null; // cancelled and expired jobs have no progress to show
}

export default function JobTracker({ status, paid }: { status: string; paid: boolean }) {
  const step = stepOf(status, paid);
  if (step === null) return null;
  const last = STEPS.length - 1;

  return (
    <div className="relative mx-3 mt-3 mb-7" aria-label={`Progress: ${STEPS[step]}`}>
      <div className="h-1.5 rounded-full bg-indigo-200">
        <motion.div
          className="h-1.5 rounded-full grad-bg"
          initial={{ width: 0 }}
          animate={{ width: `${(step / last) * 100}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>

      {STEPS.map((s, i) => (
        <div
          key={s}
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${(i / last) * 100}%` }}
        >
          <div className="relative -mt-[5px]">
            {i === step && (
              <span className="absolute inset-0 rounded-full bg-indigo-500 opacity-60 animate-ping" />
            )}
            <motion.span
              initial={{ scale: 0.6 }}
              animate={{ scale: i <= step ? 1 : 0.85 }}
              className={`relative block w-4 h-4 rounded-full border-2 ${
                i <= step ? "bg-indigo-600 border-white" : "bg-white border-indigo-300"
              }`}
            />
          </div>
          <span
            className={`absolute left-1/2 -translate-x-1/2 top-5 whitespace-nowrap text-[10px] font-semibold ${
              i <= step ? "text-indigo-800" : "text-gray-700"
            }`}
          >
            {s}
          </span>
        </div>
      ))}
    </div>
  );
}