"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/components/AdminUI";
import { toast } from "@/lib/toast";

const COMMON = [
  "password", "12345678", "123456789", "1234567890", "qwerty123", "qwertyuiop",
  "iloveyou", "11111111", "00000000", "abc12345", "password1", "welcome1",
  "admin123", "letmein1", "passw0rd",
];

type Check = { ok: boolean; label: string };

function rules(pw: string, email: string): Check[] {
  const local = email.split("@")[0].toLowerCase();
  return [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[a-z]/i.test(pw) && /\d/.test(pw), label: "A mix of letters and numbers" },
    { ok: !COMMON.includes(pw.toLowerCase()), label: "Not a common password" },
    { ok: local.length < 3 || !pw.toLowerCase().includes(local), label: "Does not contain your email name" },
  ];
}

// 0 to 4: used only for the coloured bar
function strength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const BAR = ["#d1d5db", "#ef4444", "#f59e0b", "#84cc16", "#16a34a"];
const LABEL = ["", "Weak", "Fair", "Good", "Strong"];

function Field({
  value,
  onChange,
  placeholder,
  show,
  auto,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  show: boolean;
  auto: string;
}) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 w-12 flex items-center justify-center text-indigo-500 pointer-events-none">
        <Icon name="lock" className="w-5 h-5" />
      </span>
      <input
        className="w-full border-2 border-indigo-200 rounded-xl p-3 pl-12 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        type={show ? "text" : "password"}
        autoComplete={auto}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Switch({
  on,
  onChange,
  label,
  sub,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="w-full flex items-center gap-3 text-left">
      <span className="flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {sub && <span className="block text-xs text-gray-700">{sub}</span>}
      </span>
      <span
        className="relative w-11 h-6 rounded-full transition-colors shrink-0"
        style={{ background: on ? "#4338ca" : "#9ca3af" }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow transition-transform"
          style={{ background: "#ffffff", transform: on ? "translateX(20px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}

export default function PasswordChange({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [others, setOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const checks = rules(next, email);
  const score = next ? strength(next) : 0;

  const submit = async () => {
    if (busy) return;
    setMsg("");

    if (!current) return setMsg("Enter your current password.");
    if (checks.some((c) => !c.ok)) return setMsg("The new password does not meet the rules below.");
    if (next === current) return setMsg("The new password must be different from the current one.");
    if (next !== again) return setMsg("The two new passwords do not match.");

    setBusy(true);

    // Step 1: prove the person knows the current password
    const verify = await supabase.auth.signInWithPassword({ email, password: current });
    if (verify.error) {
      setBusy(false);
      const tooMany = /rate|too many/i.test(verify.error.message);
      return setMsg(
        tooMany ? "Too many attempts. Please wait a few minutes and try again." : "Your current password is wrong."
      );
    }

    // Step 2: change it
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setBusy(false);
      return setMsg(error.message);
    }

    // Step 3: sign out every other device, keep this one
    if (others) await supabase.auth.signOut({ scope: "others" });

    setBusy(false);
    setCurrent("");
    setNext("");
    setAgain("");
    toast(others ? "Password changed. Other devices were signed out." : "Password changed", { tone: "ok", ms: 4000 });
  };

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl shadow p-4 space-y-3">
        <Field value={current} onChange={setCurrent} placeholder="Current password" show={show} auto="current-password" />
        <Field value={next} onChange={setNext} placeholder="New password" show={show} auto="new-password" />

        {next && (
          <div className="slide-in space-y-2">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-2 flex-1 rounded-full bg-indigo-100 overflow-hidden">
                  {i <= score && <div key={`${i}-${score}`} className="seg-in h-2 rounded-full" style={{ background: BAR[score] }} />}
                </div>
              ))}
            </div>
            <p className="text-xs font-bold" style={{ color: BAR[score] }}>
              {LABEL[score] || " "}
            </p>
            <ul className="grid gap-1.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-sm" style={{ opacity: c.ok ? 1 : 0.75 }}>
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2"
                    style={{
                      background: c.ok ? "#16a34a" : "transparent",
                      borderColor: c.ok ? "#16a34a" : "#9ca3af",
                      color: "#ffffff",
                    }}
                  >
                    {c.ok && (
                      <span key="ok" className="pop-check">
                        <Icon name="tick" className="w-3 h-3" />
                      </span>
                    )}
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Field value={again} onChange={setAgain} placeholder="Repeat new password" show={show} auto="new-password" />
        {again && next !== again && (
          <p className="slide-in text-xs font-semibold text-red-600">The passwords do not match yet.</p>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow p-4 space-y-4">
        <Switch on={show} onChange={setShow} label="Show passwords" />
        <Switch on={others} onChange={setOthers} label="Sign out my other devices" sub="Recommended. Keeps your account safe if a phone was lost." />
      </section>

      {msg && (
        <p
          className="slide-in flex items-start gap-2 rounded-2xl bg-white shadow p-3 text-sm font-semibold text-red-700"
          style={{ borderLeft: "4px solid #dc2626" }}
        >
          <Icon name="alert" className="w-4 h-4 mt-0.5" />
          {msg}
        </p>
      )}

      <button
        onClick={submit}
        disabled={busy}
        className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {busy && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
        {busy ? "Checking..." : "Update password"}
      </button>

      <p className="text-xs text-gray-700 text-center">
        Signed up with Google? Use Forgot password on the login page to create a password.
      </p>
    </div>
  );
}