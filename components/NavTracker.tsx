"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordPath } from "@/lib/navstack";

export default function NavTracker() {
  const path = usePathname();
  useEffect(() => {
    recordPath(path);
  }, [path]);
  return null;
}