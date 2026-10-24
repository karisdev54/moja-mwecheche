"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [mode, setMode] = useState<"login" | "signup">(
    params.get("mode") === "signup" ? "signup" : "login"
  );
  const [role, setRole] = useState<"customer" | "driver">(
    params.get("role") === "driver" ? "driver" : "customer"
  );
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setInfo("");

    if (mode === "signup") {
      if (!fullName.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (phone.replace(/\D/g, "").length < 9) {
        setError("Please enter a valid phone number.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (!agree) {
        setError("Please accept the Terms and Privacy Policy.");
        return;
      }
    }

    setLoading(true);
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName.trim(), role, phone: phone.trim() },
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    // Email confirmation is on: no session yet, so ask them to check their email
    if (mode === "signup" && !result.data.session) {
      setInfo("Account created. Check your email and click the confirmation link, then log in.");
      setMode("login");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>

        {mode === "signup" && (
          <>
            <input
              className="w-full border rounded-lg p-3"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              className="w-full border rounded-lg p-3"
              type="tel"
              placeholder="Phone (e.g. 0712345678)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <select
              className="w-full border rounded-lg p-3"
              value={role}
              onChange={(e) => setRole(e.target.value as "customer" | "driver")}
            >
              <option value="customer">I want to hire a driver</option>
              <option value="driver">I am a driver</option>
            </select>
          </>
        )}

        <input
          className="w-full border rounded-lg p-3"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded-lg p-3"
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === "signup" && (
          <label className="flex gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>
              I agree to the{" "}
              <Link href="/terms" className="underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
            </span>
          </label>
        )}

        {info && <p className="text-green-700 text-sm font-semibold">{info}</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-black text-white rounded-lg p-3 disabled:opacity-50"
        >
          {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
        </button>

        <button
          onClick={() => {
            setError("");
            setInfo("");
            setMode(mode === "login" ? "signup" : "login");
          }}
          className="w-full text-sm text-gray-900 underline"
        >
          {mode === "login" ? "No account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}

// Suspense is required because the form reads the URL (?mode=signup&role=driver)
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}