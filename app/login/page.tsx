"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import CarFields, { emptyCar, type CarState } from "@/components/CarFields";
import { Icon } from "@/components/AdminUI";
import { isNetworkError } from "@/lib/net";

import {
  cleanName,
  emailProblem,
  nameProblem,
  normalizePhone,
  normalizePlate,
  passwordProblem,
  phoneProblem,
  plateProblem,
} from "@/lib/validate";

function Field({
  icon,
  error,
  hint,
  children,
}: {
  icon: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="relative">
        <span
          className={`absolute inset-y-0 left-0 w-12 flex items-center justify-center pointer-events-none ${
            error ? "text-red-500" : "text-indigo-500"
          }`}
        >
          <Icon name={icon} className="w-5 h-5" />
        </span>
        {children}
      </div>
      {error ? (
        <p className="slide-in text-xs text-red-600 font-semibold mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-green-700 font-semibold mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

const inp = (err?: string, extra = "") =>
  `w-full border-2 rounded-xl p-3 pl-12 bg-white transition-shadow focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 ${
    err ? "border-red-500" : "border-indigo-200"
  } ${extra}`;

type Mode = "login" | "signup" | "forgot";
type Errs = {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  agree?: string;
  car?: string;
};

// Turns Supabase's technical messages into plain language
function friendly(m: string): string {
  const s = m.toLowerCase();
  if (s.includes("invalid login")) return "Wrong email or password.";
  if (s.includes("email not confirmed")) return "Please confirm your email first. Check your inbox.";
  if (s.includes("already registered") || s.includes("already been registered"))
    return "That email already has an account. Try logging in.";
  if (s.includes("database error saving"))
    return "We could not create your account. That phone number, email or number plate may already be registered.";
  if (s.includes("rate limit") || s.includes("too many") || s.includes("seconds"))
    return "Too many attempts. Please wait a few minutes and try again.";
  if (s.includes("weak") || s.includes("easy to guess")) return "That password is too easy to guess. Try a longer one.";
  if (isNetworkError(m)) return "Network error. Check your internet connection and try again.";
  return m;

}

const TAGLINE: Record<Mode, string> = {
  login: "Welcome back. Log in to book or drive.",
  signup: "Join in under a minute. Hire a driver or start driving.",
  forgot: "No problem. We will email you a link to reset it.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const socialTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [role, setRole] = useState<"customer" | "driver">(params.get("role") === "driver" ? "driver" : "customer");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [car, setCar] = useState<CarState>(emptyCar);
  const [errs, setErrs] = useState<Errs>({});
  const [error, setError] = useState(params.get("error_description") ?? "");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const busy = loading || socialBusy;
  const setErr = (k: keyof Errs, v?: string) => setErrs((e) => ({ ...e, [k]: v }));
  const phoneNorm = normalizePhone(phone);

  // Already logged in? Skip the form
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) router.replace("/dashboard");
    });
    return () => {
      active = false;
    };
  }, [router]);

  // If the person comes back from Google (back button, closed tab), re-enable the button
  useEffect(() => {
    const clear = () => {
      if (socialTimer.current) clearTimeout(socialTimer.current);
    };
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        clear();
        setSocialBusy(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") setTimeout(() => setSocialBusy(false), 800);
    };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
      clear();
    };
  }, []);

  const clearForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setShowPw(false);
    setAgree(false);
    setCar(emptyCar);
    setErrs({});
  };

  const goTo = (m: Mode) => {
    if (m === mode) return;
    setError("");
    setInfo("");
    setUnconfirmed(false);
    clearForm();
    setMode(m);
  };

  const validate = (): boolean => {
    const next: Errs = {};
    const e = emailProblem(email);
    if (e) next.email = e;

    if (mode === "signup") {
      const n = nameProblem(fullName);
      if (n) next.name = n;
      const p = phoneProblem(phone);
      if (p) next.phone = p;

      if (car.has === null) next.car = "Tell us if you have a car.";
      else if (car.has) {
        const cp = plateProblem(car.plate);
        if (cp) next.car = cp;
      }

      const pw = passwordProblem(password, false);
      if (pw) next.password = pw;
      if (!agree) next.agree = "Please accept the Terms and Privacy Policy.";
    } else if (mode === "login") {
      const pw = passwordProblem(password, true);
      if (pw) next.password = pw;
    }

    setErrs(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (busy) return;
    setError("");
    setInfo("");
    setUnconfirmed(false);
    if (!validate()) return;

    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);

    if (mode === "signup" && phoneNorm) {
      const { data: free } = await supabase.rpc("phone_available", { p_phone: phoneNorm });
      if (free === false) {
        setLoading(false);
        setErr("phone", "That phone number is already registered. Try logging in.");
        return;
      }
    }

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: cleanName(fullName),
                role,
                phone: phoneNorm,
                has_car: car.has,
                car_plate: car.has ? normalizePlate(car.plate) : null,
                car_details: car.has ? car.details.trim() || null : null,
              },
              emailRedirectTo: `${window.location.origin}/dashboard`,
            },
          })
        : await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);

    if (result.error) {
      if (/not confirmed/i.test(result.error.message)) setUnconfirmed(true);
      return setError(friendly(result.error.message));
    }

    // With email confirmation on, an existing email comes back as "success" with no identities
    if (mode === "signup" && result.data.user && (result.data.user.identities?.length ?? 0) === 0) {
      return setErr("email", "That email already has an account. Try logging in.");
    }

    if (mode === "signup" && !result.data.session) {
      clearForm();
      setMode("login");
      setInfo("Account created. Check your email and click the confirmation link, then log in.");
      return;
    }

    router.push("/dashboard");
  };

  const resend = async () => {
    if (busy) return;
    setError("");
    const { error: e } = await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase() });
    if (e) return setError(friendly(e.message));
    setUnconfirmed(false);
    setInfo("Confirmation email sent. Check your inbox and spam folder.");
  };

  const sendReset = async () => {
    if (busy) return;
    setError("");
    setInfo("");
    const e = emailProblem(email);
    if (e) return setErr("email", e);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err && /rate|too many|seconds/i.test(err.message)) {
      return setError("Please wait a minute before asking again.");
    }
    setInfo("If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.");
  };

  const social = async (provider: "google" | "apple") => {
    if (busy) return;
    setError("");
    setInfo("");
    setSocialBusy(true);

    // If Google never finishes, stop waiting and let the person try again
    if (socialTimer.current) clearTimeout(socialTimer.current);
    socialTimer.current = setTimeout(() => {
      setSocialBusy(false);
      setError("Google sign-in did not finish. Please try again.");
    }, 20000);

    const { error: e } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/complete?role=${role}` },
    });
    if (e) {
      if (socialTimer.current) clearTimeout(socialTimer.current);
      setSocialBusy(false);
      setError(e.message);
    }
    // On success the browser leaves this page, so there is nothing more to do here
  };

  const title = mode === "login" ? "Log in" : mode === "signup" ? "Create your account" : "Reset your password";
  const cta = mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link";

  return (
    <main className="min-h-dvh relative overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="aurora pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-sm px-4 pt-5 pb-10 flex flex-col gap-5 min-h-dvh">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 glass rounded-full px-3.5 py-2 text-sm font-semibold active:scale-95">
            <Icon name="back" className="w-4 h-4" />
            Home
          </Link>
        </div>

        <div className="text-center space-y-2 anim-rise">
          <div className="flex justify-center">
            <Brand />
          </div>
          <p key={mode} className="text-sm text-gray-700 slide-in">{TAGLINE[mode]}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-5 space-y-4 anim-rise" style={{ animationDelay: "0.1s" }}>
          {mode !== "forgot" ? (
            <div className="relative grid grid-cols-2 rounded-2xl bg-indigo-100 p-1" role="tablist">
              <span
                aria-hidden="true"
                className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl bg-white shadow transition-transform duration-300 ease-out"
                style={{ transform: mode === "signup" ? "translateX(100%)" : "translateX(0)" }}
              />
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => goTo(m)}
                  className={`relative z-10 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                    mode === m ? "text-indigo-800" : "text-gray-700"
                  }`}
                >
                  {m === "login" ? "Log in" : "Sign up"}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => goTo("login")}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700"
            >
              <Icon name="back" className="w-4 h-4" />
              Back to log in
            </button>
          )}

          <form
            key={mode}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "forgot") sendReset();
              else submit();
            }}
            className="space-y-4 slide-in"
          >
            <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>

            {mode === "signup" && (
              <>
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
                          on
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-lg"
                            : "border-indigo-200 bg-white text-gray-900"
                        }`}
                      >
                        <Icon name={o.icon} className="w-6 h-6" />
                        {o.label}
                      </button>
                    );
                  })}
                </div>

                <Field icon="user" error={errs.name}>
                  <input
                    className={inp(errs.name)}
                    name="signup-name"
                    autoComplete="off"
                    placeholder="Full name (first and last)"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setErr("name", undefined);
                    }}
                    onBlur={() => fullName && setErr("name", nameProblem(fullName) ?? undefined)}
                  />
                </Field>

                <Field
                  icon="phone"
                  error={errs.phone}
                  hint={phoneNorm && !errs.phone ? `Will be saved as ${phoneNorm}` : undefined}
                >
                  <input
                    className={inp(errs.phone)}
                    name="signup-phone"
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
                </Field>

                <CarFields
                  value={car}
                  onChange={(v) => {
                    setCar(v);
                    setErr("car", undefined);
                  }}
                  error={errs.car}
                />
              </>
            )}

            <Field icon="mail" error={errs.email}>
              <input
                className={inp(errs.email)}
                name={mode === "signup" ? "signup-email" : "login-email"}
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete={mode === "signup" ? "off" : "username"}
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErr("email", undefined);
                }}
                onBlur={() => email && setErr("email", emailProblem(email) ?? undefined)}
              />
            </Field>

            {mode !== "forgot" && (
              <div className="space-y-1">
                <Field icon="lock" error={errs.password}>
                  <input
                    className={inp(errs.password, "stay")}
                    name={mode === "login" ? "login-password" : "signup-password"}
                    type={showPw ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "login" ? "Password" : "Password (8+ characters, letters and numbers)"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErr("password", undefined);
                    }}
                    onBlur={() =>
                      mode === "signup" && password && setErr("password", passwordProblem(password, false) ?? undefined)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-gray-700 active:scale-90"
                  >
                    <Icon name={showPw ? "eyeoff" : "eye"} className="w-5 h-5" />
                  </button>
                </Field>
                {mode === "login" && (
                  <div className="text-right">
                    <button type="button" onClick={() => goTo("forgot")} className="text-sm font-bold text-indigo-700">
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {mode === "signup" && (
              <div>
                <label className="flex items-start gap-2 text-sm text-gray-900 select-none">
                  <input
                    type="checkbox"
                    autoComplete="off"
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
                {errs.agree && <p className="text-xs text-red-600 font-semibold mt-1">{errs.agree}</p>}
              </div>
            )}

            {info && (
              <p className="slide-in flex items-start gap-2 rounded-xl bg-green-50 text-green-800 text-sm font-semibold p-3">
                <Icon name="check" className="w-4 h-4 mt-0.5 shrink-0" />
                {info}
              </p>
            )}
            {error && (
              <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </p>
            )}
            {unconfirmed && (
              <button type="button" onClick={resend} className="text-sm font-bold text-indigo-700 underline">
                Resend the confirmation email
              </button>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              {loading ? "Please wait..." : cta}
            </button>

            {mode !== "forgot" && (
              <>
                <div className="flex items-center gap-3 text-xs text-gray-700">
                  <span className="flex-1 border-t" /> or <span className="flex-1 border-t" />
                </div>

                <button
                  type="button"
                  onClick={() => social("google")}
                  disabled={busy}
                  className="w-full bg-white border-2 border-indigo-200 font-bold rounded-2xl p-3.5 flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-60"
                >
                  {socialBusy ? (
                    <span className="w-4 h-4 rounded-full border-2 border-indigo-200 border-t-indigo-700 animate-spin" />
                  ) : (
                    <span className="text-lg font-extrabold leading-none" style={{ color: "#4285f4" }}>G</span>
                  )}
                  {socialBusy ? "Opening Google..." : "Continue with Google"}
                </button>

                {process.env.NEXT_PUBLIC_APPLE_SIGNIN === "true" && (
                  <button
                    type="button"
                    onClick={() => social("apple")}
                    disabled={busy}
                    className="w-full bg-black text-white font-bold rounded-2xl p-3.5 disabled:opacity-60"
                  >
                    Continue with Apple
                  </button>
                )}
              </>
            )}
          </form>
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}