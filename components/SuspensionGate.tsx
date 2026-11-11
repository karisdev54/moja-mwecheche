"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Pages a suspended person may still open
const ALLOWED = ["/suspended", "/terms", "/privacy", "/goodbye"];

export default function SuspensionGate() {
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    let active = true;

    const check = async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session || !active) return;
      const { data } = await supabase
        .from("profiles")
        .select("suspended")
        .eq("id", s.session.user.id)
        .maybeSingle();
      if (!active) return;
      if (data?.suspended && !ALLOWED.includes(path)) router.replace("/suspended");
      if (!data?.suspended && path === "/suspended") router.replace("/dashboard");
    };

    check();
    const t = setInterval(check, 60000); // catches a suspension that happens while the app is open
    window.addEventListener("focus", check);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("focus", check);
    };
  }, [path, router]);

  return null;
}