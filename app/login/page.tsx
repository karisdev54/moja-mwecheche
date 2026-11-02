"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";
import CarFields, { emptyCar, type CarState } from "@/components/CarFields";
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">{icon}</span>
        {children}
      </div>
      {error ? (
        <p className="text-xs text-red-600 font-semibold mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-green-700 font-semibold mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

const inp = (err?: string, extra = "") =>
  `w-full border-2 rounded-xl p-3 pl-11 focus:border-indigo-500 ${
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
  return m;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

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
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/complete?role=${role}` },
    });
    if (e) {
      setSocialBusy(false);
      setError(e.message);
    }
  };

  const title =
    mode === "login" ? "Welcome back 👋" : mode === "signup" ? "Create your account" : "Reset your password";
  const subtitle =
    mode === "login"
      ? "Log in to book or drive."
      : mode === "signup"
        ? "It takes less than a minute."
        : "Enter your email and we will send you a link.";

  return (
    <main
      className="min-h-dvh relative overflow-hidden flex flex-col items-center justify-center p-4 gap-5"
      style={{ background: "linear-gradient(160deg, var(--bg), var(--surface))" }}
    >
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-indigo-500 opacity-25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-cyan-400 opacity-25 blur-3xl" />

      <Link href="/" className="absolute top-4 left-4 text-sm font-semibold z-10">
        ← Home
      </Link>

      <div className="relative z-10 anim-rise">
        <Brand />
      </div>

      <form
        key={mode}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "forgot") sendReset();
          else submit();
        }}
        className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 space-y-4 anim-rise"
      >
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-gray-700">{subtitle}</p>
        </div>

        {mode === "signup" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "customer" as const, icon: "🚗", label: "I want to hire a driver" },
                { v: "driver" as const, icon: "🧑‍✈️", label: "I am a driver" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setRole(o.v)}
                  className={`rounded-xl border-2 p-3 text-sm font-semibold text-center ${
                    role === o.v
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-indigo-200 bg-white text-gray-900"
                  }`}
                >
                  <span className="block text-2xl">{o.icon}</span>
                  {o.label}
                </button>
              ))}
            </div>

            <Field icon="👤" error={errs.name}>
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
              icon="📞"
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

        <Field icon="✉️" error={errs.email}>
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
            <Field icon="🔒" error={errs.password}>
              <input
                className={inp(errs.password, "pr-16")}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-indigo-700"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </Field>
            {mode === "login" && (
              <div className="text-right">
                <button type="button" onClick={() => goTo("forgot")} className="text-sm font-semibold text-indigo-700 underline">
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

        {info && <p className="text-green-700 text-sm font-semibold">{info}</p>}
        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
        {unconfirmed && (
          <button type="button" onClick={resend} className="text-sm font-semibold text-indigo-700 underline">
            Resend the confirmation email
          </button>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full text-white font-bold rounded-xl p-4 shadow-lg disabled:opacity-60"
          style={{ background: "linear-gradient(90deg,#4338ca,#0e7490)" }}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Log in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
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
              className="w-full bg-white border-2 border-indigo-200 font-semibold rounded-xl p-3 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span className="font-extrabold" style={{ color: "#4285f4" }}>G</span>
              {socialBusy ? "Opening Google..." : "Continue with Google"}
            </button>

            {process.env.NEXT_PUBLIC_APPLE_SIGNIN === "true" && (
              <button
                type="button"
                onClick={() => social("apple")}
                disabled={busy}
                className="w-full bg-black text-white font-semibold rounded-xl p-3 disabled:opacity-60"
              >
                Continue with Apple
              </button>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => goTo(mode === "login" ? "signup" : "login")}
          className="w-full text-sm font-semibold text-indigo-700 underline"
        >
          {mode === "login"
            ? "New here? Create an account"
            : mode === "signup"
              ? "Already have an account? Log in"
              : "← Back to log in"}
        </button>
      </form>

      <p className="relative z-10 text-xs text-gray-700">🔒 Verified drivers · Secure M-Pesa payments</p>
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