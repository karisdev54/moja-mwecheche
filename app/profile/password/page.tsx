"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PasswordChange from "@/components/PasswordChange";
import Loader from "@/components/Loader";

export default function PasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.replace("/login");
        return;
      }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      if (!active) return;
      if (p?.role === "admin") {
        router.replace("/profile");
        return;
      }
      setEmail(u.user.email ?? "");
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (email === null) return <Loader full />;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-md mx-auto space-y-4 text-gray-900 stagger">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Change password</h1>
          <Link href="/profile" className="text-sm underline font-semibold">Back</Link>
        </div>
        <PasswordChange email={email} />
      </div>
    </main>
  );
}