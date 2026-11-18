"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PasswordChange from "@/components/PasswordChange";
import Loader from "@/components/Loader";
import { Icon, PageHeader } from "@/components/AdminUI";

export default function PasswordPage() {
  const router = useRouter();
  const [info, setInfo] = useState<{ email: string; hasPassword: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.replace("/login");
        return;
      }
      const { data: has } = await supabase.rpc("my_has_password");
      if (active) setInfo({ email: u.user.email ?? "", hasPassword: has !== false });
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (!info) return <Loader full />;

  const creating = !info.hasPassword;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
        <PageHeader
          title={creating ? "Create a password" : "Change password"}
          subtitle={creating ? "Log in with email as well as Google" : "Keep your account safe"}
          href="/profile"
          back="Profile"
        />

        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen flex items-center gap-4"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <span className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center float">
            <Icon name="shield" className="w-6 h-6" />
          </span>
          <div>
            <p className="font-extrabold text-lg leading-tight">{creating ? "Add a second way in" : "Protect your account"}</p>
            <p className="text-sm text-white/85">
              {creating ? "A password means you are never locked out if Google has a problem." : "Choose a strong password you do not use anywhere else."}
            </p>
          </div>
        </section>

        <PasswordChange email={info.email} hasPassword={info.hasPassword} />
      </div>
    </main>
  );
}