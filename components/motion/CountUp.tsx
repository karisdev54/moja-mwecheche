"use client";
import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

export default function CountUp({
  value,
  prefix = "",
  duration = 0.9,
}: {
  value: number;
  prefix?: string;
  duration?: number;
}) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${prefix}${Math.round(v).toLocaleString()}`);

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [value, duration, mv]);

  return <motion.span>{text}</motion.span>;
}