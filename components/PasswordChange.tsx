"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

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

// 0 to 4: used only for the colored bar
function strength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const BAR = ["bg-gray-300", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-green-600"];
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
    <input
      className="w-full border-2 border-indigo-200 rounded-lg p-3"
      type={show ? "text" : "password"}
      autoComplete={auto}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function PasswordChange({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [others, setOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const checks = rules(next, email);
  const score = next ? strength(next) : 0;

  const submit = async () => {
    setMsg(null);

    if (!current) return setMsg({ ok: false, text: "Enter your current password." });
    if (checks.some((c) => !c.ok)) return setMsg({ ok: false, text: "The new password does not meet the rules below." });
    if (next === current) return setMsg({ ok: false, text: "The new password must be different from the current one." });
    if (next !== again) return setMsg({ ok: false, text: "The two new passwords do not match." });

    setBusy(true);

    // Step 1: prove the person knows the current password
    const verify = await supabase.auth.signInWithPassword({ email, password: current });
    if (verify.error) {
      setBusy(false);
      const tooMany = /rate|too many/i.test(verify.error.message);
      return setMsg({
        ok: false,
        text: tooMany
          ? "Too many attempts. Please wait a few minutes and try again."
          : "Your current password is wrong.",
      });
    }

    // Step 2: change it
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setBusy(false);
      return setMsg({ ok: false, text: error.message });
    }

    // Step 3: sign out every other device, keep this one
    if (others) await supabase.auth.signOut({ scope: "others" });

    setBusy(false);
    setCurrent("");
    setNext("");
    setAgain("");
    setMsg({
      ok: true,
      text: others
        ? "Password changed ✓ You were signed out on your other devices."
        : "Password changed ✓",
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4 space-y-3">
      <h2 className="font-bold">Change password</h2>

      <Field value={current} onChange={setCurrent} placeholder="Current password" show={show} auto="current-password" />
      <Field value={next} onChange={setNext} placeholder="New password" show={show} auto="new-password" />

      {next && (
        <div className="space-y-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-2 flex-1 rounded-full ${i <= score ? BAR[score] : "bg-gray-200"}`} />
            ))}
          </div>
          <p className="text-xs font-semibold">{LABEL[score]}</p>
          <ul className="text-xs space-y-0.5">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? "text-green-700" : "text-gray-700"}>
                {c.ok ? "✓" : "○"} {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Field value={again} onChange={setAgain} placeholder="Repeat new password" show={show} auto="new-password" />
      {again && next !== again && <p className="text-xs text-red-600">The passwords do not match yet.</p>}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show passwords
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} />
        Sign me out on my other devices
      </label>

      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full bg-indigo-600 text-white font-bold rounded-lg p-3 disabled:opacity-50"
      >
        {busy ? "Checking..." : "Update password"}
      </button>
    </div>
  );
}