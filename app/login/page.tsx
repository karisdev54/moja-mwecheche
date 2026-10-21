"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"customer" | "driver">("customer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");

    if (mode === "signup") {
      if (!fullName.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (phone.replace(/\D/g, "").length < 9) {
        setError("Please enter a valid phone number.");
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
              color="black"  
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
          color="black"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border rounded-lg p-3"
          type="password"
          placeholder="Password (min 6 characters)"
          color=""
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

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
            setMode(mode === "login" ? "signup" : "login");
          }}
          className="w-full text-sm text-black-600 underline"
        >
          {mode === "login"
            ? "No account? Sign up"
            : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}