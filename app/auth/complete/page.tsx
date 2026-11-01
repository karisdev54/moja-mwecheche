"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import Loader from "@/components/Loader";
import { friendlyDbError, normalizePhone } from "@/lib/validate";

function Finish() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"customer" | "driver">(params.get("role") === "driver" ? "driver" : "customer");
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("phone,full_name")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!active) return;
      if (p?.phone) {
        router.replace("/dashboard");
        return;
      }
      setName(p?.full_name ?? "");
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const submit = async () => {
    setError("");
        const pNorm = normalizePhone(phone);
    if (!pNorm) return setError("Enter a valid Kenyan number, e.g. 0712 345 678.");
    if (!agree) return setError("Please accept the Terms and Privacy Policy.");
    setBusy(true);
    const { error: e } = await supabase.rpc("complete_social_signup", { p_role: role, p_phone: pNorm});
    setBusy(false);
    if (e) return setError(friendlyDbError(e.message, e.code));
    router.replace("/dashboard");
  };

  if (!ready) return <Loader full />;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-4 gap-5">
      <Brand />
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 space-y-4 text-gray-900 anim-rise">
        <div>
          <h1 className="text-2xl font-bold">Welcome{name ? `, ${name.split(" ")[0]}` : ""} 👋</h1>
          <p className="text-sm">One last step to finish your account.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { v: "customer" as const, icon: "🚗", label: "I want to hire a driver" },
            { v: "driver" as const, icon: "🧑‍✈️", label: "I want to drive" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setRole(o.v)}
              className={`rounded-xl border-2 p-3 text-sm font-semibold ${
                role === o.v ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
              }`}
            >
              <span className="block text-2xl">{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>

        <input
          className="w-full border-2 border-indigo-200 rounded-xl p-3"
          type="tel"
          placeholder="Phone (e.g. 0712345678)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <label className="flex gap-2 text-sm">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I agree to the <Link href="/terms" className="underline font-semibold">Terms</Link> and{" "}
            <Link href="/privacy" className="underline font-semibold">Privacy Policy</Link>
          </span>
        </label>

        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full text-white font-bold rounded-xl p-4 disabled:opacity-60"
          style={{ background: "linear-gradient(90deg,#4338ca,#0e7490)" }}
        >
          {busy ? "Saving..." : "Finish"}
        </button>
      </div>
    </main>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={null}>
      <Finish />
    </Suspense>
  );
}