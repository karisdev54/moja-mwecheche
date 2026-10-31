"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Brand from "@/components/Brand";

function Field({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">{icon}</span>
      {children}
    </div>
  );
}

const INPUT = "w-full border-2 border-indigo-200 rounded-xl p-3 pl-11 focus:border-indigo-500";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [role, setRole] = useState<"customer" | "driver">(params.get("role") === "driver" ? "driver" : "customer");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const clearForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setShowPw(false);
    setAgree(false);
  };

  const switchMode = () => {
    setError("");
    setInfo("");
    clearForm();
    setMode(mode === "login" ? "signup" : "login");
  };

  const submit = async () => {
    setError("");
    setInfo("");

    if (mode === "signup") {
      if (!fullName.trim()) return setError("Please enter your full name.");
      if (phone.replace(/\D/g, "").length < 9) return setError("Please enter a valid phone number.");
      if (password.length < 8) return setError("Password must be at least 8 characters.");
      if (!agree) return setError("Please accept the Terms and Privacy Policy.");
    }

    setLoading(true);
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: fullName.trim(), role, phone: phone.trim() } },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);

    if (result.error) return setError(result.error.message);

    // Email confirmation is on: no session yet, so ask them to check their email
    if (mode === "signup" && !result.data.session) {
      clearForm();
      setMode("login");
      setInfo("Account created. Check your email and click the confirmation link, then log in.");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main
      className="min-h-dvh relative overflow-hidden flex flex-col items-center justify-center p-4 gap-5"
      style={{ background: "linear-gradient(160deg, var(--bg), var(--surface))" }}
    >
      {/* Soft glow shapes */}
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
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 space-y-4 anim-rise"
      >
        <div>
          <h1 className="text-2xl font-bold">{mode === "login" ? "Welcome back 👋" : "Create your account"}</h1>
          <p className="text-sm text-gray-700">
            {mode === "login" ? "Log in to book or drive." : "It takes less than a minute."}
          </p>
        </div>

        {mode === "signup" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "customer" as const, icon: "🚗", label: "I want to hire a driver" },
                { v: "driver" as const, icon: "🧑‍✈️", label: "I want to drive" },
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

            <Field icon="👤">
              <input className={INPUT} name="signup-name" autoComplete="off" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field icon="📞">
              <input className={INPUT} name="signup-phone" type="tel" autoComplete="off" placeholder="Phone (e.g. 0712345678)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </>
        )}

        <Field icon="✉️">
          <input
            className={INPUT}
            name={mode === "login" ? "login-email" : "signup-email"}
            type="email"
            autoComplete={mode === "login" ? "username" : "off"}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field icon="🔒">
          <input
            className={`${INPUT} pr-16`}
            name={mode === "login" ? "login-password" : "signup-password"}
            type={showPw ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "login" ? "Password" : "Password (min 8 characters)"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-indigo-700"
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </Field>

        {mode === "signup" && (
          <label className="flex gap-2 text-sm text-gray-900">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              I agree to the <Link href="/terms" className="underline font-semibold">Terms</Link> and{" "}
              <Link href="/privacy" className="underline font-semibold">Privacy Policy</Link>
            </span>
          </label>
        )}

        {info && <p className="text-green-700 text-sm font-semibold">{info}</p>}
        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-white font-bold rounded-xl p-4 shadow-lg disabled:opacity-50"
          style={{ background: "linear-gradient(90deg,#4338ca,#0e7490)" }}
        >
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>

        <button type="button" onClick={switchMode} className="w-full text-sm font-semibold text-gray-900 underline">
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
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