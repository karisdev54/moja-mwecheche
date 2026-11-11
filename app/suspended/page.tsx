"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import { Skeleton } from "@/components/Loader";

const SUPPORT_EMAIL = "kariukiobadiah655@gmail.com"; // change to your real support email
const SUPPORT_PHONE = ""; // optional, e.g. "+254712345678". Leave empty to hide the call button

export default function SuspendedPage() {
  const router = useRouter();
  const [info, setInfo] = useState<{ name: string; email: string; reason: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.replace("/login");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("suspended,suspended_reason,full_name")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!active) return;
      if (!p?.suspended) {
        router.replace("/dashboard");
        return;
      }
      setInfo({ name: p.full_name ?? "", email: u.user.email ?? "", reason: p.suspended_reason ?? "" });
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  const mail = info
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Suspended account")}&body=${encodeURIComponent(
        `Hello, my account (${info.email}) is suspended and I would like to talk about it.`
      )}`
    : "#";

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center p-4 gap-5"
      style={{ background: "linear-gradient(160deg, var(--bg), var(--surface))" }}
    >
      <Brand />
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 space-y-4 text-center text-gray-900 pop-in">
        {!info ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-10 mx-auto !rounded-full" />
            <Skeleton className="h-6 w-2/3 mx-auto" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <p className="text-5xl">⛔</p>
            <h1 className="text-2xl font-extrabold">Account suspended</h1>
            {info.reason && (
              <p className="text-sm bg-red-50 border-2 border-red-200 text-red-800 rounded-xl p-3">{info.reason}</p>
            )}
            <p className="text-sm">
              You cannot use the app right now. If you think this is a mistake, please contact support.
            </p>

            <a
              href={mail}
              className="block text-white font-bold rounded-xl p-4"
              style={{ background: "linear-gradient(90deg,#4338ca,#0e7490)" }}
            >
              ✉️ Contact support
            </a>
            {SUPPORT_PHONE && (
              <a href={`tel:${SUPPORT_PHONE}`} className="block bg-white border-2 border-indigo-300 font-bold rounded-xl p-3">
                📞 Call support
              </a>
            )}
            <button onClick={logout} className="w-full bg-white border-2 border-red-300 text-red-700 font-bold rounded-xl p-3">
              Log out
            </button>
          </>
        )}
      </div>
    </main>
  );
}