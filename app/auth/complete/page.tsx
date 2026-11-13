"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import Loader from "@/components/Loader";
import CarFields, { emptyCar, type CarState } from "@/components/CarFields";
import { Icon } from "@/components/AdminUI";
import { friendlyError } from "@/lib/net";
import { friendlyDbError, normalizePhone, normalizePlate, phoneProblem, plateProblem } from "@/lib/validate";

const inp = (err?: string) =>
  `w-full border-2 rounded-xl p-3 pl-12 bg-white transition-shadow focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 ${
    err ? "border-red-500" : "border-indigo-200"
  }`;

type Errs = { phone?: string; car?: string; agree?: string };

function Finish() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [role, setRole] = useState<"customer" | "driver">(params.get("role") === "driver" ? "driver" : "customer");
  const [phone, setPhone] = useState("");
  const [car, setCar] = useState<CarState>(emptyCar);
  const [agree, setAgree] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const phoneNorm = normalizePhone(phone);
  const setErr = (k: keyof Errs, v?: string) => setErrs((e) => ({ ...e, [k]: v }));

  useEffect(() => {
    let active = true;
    const err = params.get("error_description");
    if (err) {
      router.replace(`/login?error_description=${encodeURIComponent(err)}`);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) {
        router.replace(`/login?error_description=${encodeURIComponent("Google sign-in did not finish. Please try again.")}`);
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("phone,full_name,avatar_url")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!active) return;
      if (p?.phone) {
        router.replace("/dashboard");
        return;
      }
      setName(p?.full_name ?? "");
      setAvatar(p?.avatar_url ?? null);
      setEmail(data.session.user.email ?? "");
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [router, params]);

  const submit = async () => {
    if (busy) return;
    setError("");
    const next: Errs = {};
    const pe = phoneProblem(phone);
    if (pe) next.phone = pe;
    if (car.has === null) next.car = "Tell us if you have a car.";
    else if (car.has) {
      const cp = plateProblem(car.plate);
      if (cp) next.car = cp;
    }
    if (!agree) next.agree = "Please accept the Terms and Privacy Policy.";
    setErrs(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    const { error: e } = await supabase.rpc("complete_social_signup", {
      p_role: role,
      p_phone: phoneNorm as string,
      p_has_car: car.has,
      p_plate: car.has ? normalizePlate(car.plate) : null,
      p_car: car.has ? car.details.trim() || null : null,
    });
    setBusy(false);
    if (e) return setError(friendlyError(friendlyDbError(e.message, e.code)));
    router.replace("/dashboard");
  };

  const logoutInstead = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (!ready) return <Loader full />;

  const first = name.trim().split(" ")[0];
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <main className="min-h-dvh relative overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="aurora pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-sm px-4 pt-5 pb-10 flex flex-col gap-5 min-h-dvh">
        <div className="text-center space-y-2 anim-rise pt-2">
          <div className="flex justify-center">
            <Brand />
          </div>
          <p className="text-sm text-gray-700">One last step to finish your account.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-5 space-y-4 anim-rise" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-3 rounded-2xl bg-indigo-50 border border-indigo-100 p-3">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold shrink-0">{initial}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight truncate">{first ? `Welcome, ${first}` : "Welcome"}</p>
              <p className="text-xs text-gray-700 truncate">{email}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: "color-mix(in srgb, #059669 14%, var(--surface))", color: "#059669" }}>
              <Icon name="tick" className="w-3 h-3" size={12} />
              Google
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">How will you use KEY AND GO?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "customer" as const, icon: "car", label: "Hire a driver" },
                { v: "driver" as const, icon: "key", label: "I am a driver" },
              ].map((o) => {
                const on = role === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setRole(o.v)}
                    className={`rounded-2xl border-2 p-3 text-sm font-bold flex flex-col items-center gap-1 transition-all active:scale-95 ${
                      on ? "border-indigo-600 bg-indigo-600 text-white shadow-lg" : "border-indigo-200 bg-white text-gray-900"
                    }`}
                  >
                    <Icon name={o.icon} className="w-6 h-6" />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="relative">
              <span className={`absolute inset-y-0 left-0 w-12 flex items-center justify-center pointer-events-none ${errs.phone ? "text-red-500" : "text-indigo-500"}`}>
                <Icon name="phone" className="w-5 h-5" />
              </span>
              <input
                className={inp(errs.phone)}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="Phone (e.g. 0712 345 678)"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setErr("phone", undefined);
                }}
                onBlur={() => phone && setErr("phone", phoneProblem(phone) ?? undefined)}
              />
            </div>
            {errs.phone ? (
              <p className="slide-in text-xs text-red-600 font-semibold mt-1">{errs.phone}</p>
            ) : phoneNorm ? (
              <p className="text-xs text-green-700 font-semibold mt-1">Will be saved as {phoneNorm}</p>
            ) : null}
          </div>

          <CarFields
            value={car}
            onChange={(v) => {
              setCar(v);
              setErr("car", undefined);
            }}
            error={errs.car}
          />

          <div>
            <label className="flex items-start gap-2 text-sm select-none">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  setErr("agree", undefined);
                }}
              />
              <span>
                I agree to the <Link href="/terms" className="underline font-semibold">Terms</Link> and{" "}
                <Link href="/privacy" className="underline font-semibold">Privacy Policy</Link>
              </span>
            </label>
            {errs.agree && <p className="slide-in text-xs text-red-600 font-semibold mt-1">{errs.agree}</p>}
          </div>

          {error && (
            <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
              <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            {busy ? "Saving..." : "Finish and continue"}
          </button>

          <button onClick={logoutInstead} className="w-full text-sm font-bold text-gray-700">
            Use a different account
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-gray-800 anim-rise" style={{ animationDelay: "0.2s" }}>
          {[
            { icon: "verify", text: "Verified drivers" },
            { icon: "wallet", text: "Pay with M-Pesa" },
            { icon: "pin", text: "Live tracking" },
          ].map((t) => (
            <div key={t.text} className="glass rounded-2xl p-3 flex flex-col items-center gap-1.5">
              <span className="text-indigo-600">
                <Icon name={t.icon} className="w-5 h-5" />
              </span>
              {t.text}
            </div>
          ))}
        </div>
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