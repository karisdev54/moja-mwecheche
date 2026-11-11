"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PasswordChange from "@/components/PasswordChange";
import Loader from "@/components/Loader";
import { Icon, PageHeader } from "@/components/AdminUI";

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
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
        <PageHeader title="Change password" subtitle="Keep your account safe" href="/profile" />

        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen flex items-center gap-4"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center float">
            <Icon name="shield" className="w-6 h-6" />
          </span>
          <div>
            <p className="font-extrabold text-lg leading-tight">Protect your account</p>
            <p className="text-sm text-white/85">Choose a strong password you do not use anywhere else.</p>
          </div>
        </section>

        <PasswordChange email={email} />
      </div>
    </main>
  );
}