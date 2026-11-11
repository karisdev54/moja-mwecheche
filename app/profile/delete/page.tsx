"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import { confirmDialog } from "@/lib/dialog";

type Blocker = { code: string; message: string };

export default function DeleteAccountPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.replace("/login");
        return;
      }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      if (!active) return;
      if (p?.role === "admin") {
        router.replace("/profile");
        return;
      }
      const providers = (u.user.app_metadata?.providers as string[] | undefined) ?? [];
      const { data: b } = await supabase.rpc("my_delete_blockers");
      if (!active) return;
      setHasPassword(providers.includes("email"));
      setBlockers((b ?? []) as Blocker[]);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [router, tick]);

  const recheck = () => {
    setReady(false);
    setTick((t) => t + 1);
  };

  const remove = async () => {
    if (busy) return;
    setError("");
    if (typed.trim().toUpperCase() !== "DELETE") return setError("Type the word DELETE to confirm.");
    if (hasPassword && !password) return setError("Enter your password.");

    const ok = await confirmDialog({
      title: "Delete your account forever?",
      message:
        "This cannot be undone. Your profile, photos, documents and car details will be erased, and you will be signed out.",
      confirmText: "Yes, delete everything",
      cancelText: "Keep my account",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token}` },
      body: JSON.stringify({ confirm: "DELETE", password }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);

    if (!res.ok) {
      setError(json.error ?? "Could not delete the account.");
      if (res.status === 409) recheck();
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/goodbye?deleted=1");
  };

  if (!ready) return <Loader full />;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-md mx-auto space-y-4 text-gray-900 stagger">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Delete account</h1>
          <Link href="/profile" className="text-sm underline font-semibold">Back</Link>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 space-y-2 text-sm">
          <p className="font-bold">What happens</p>
          <p>🗑 Erased: your login, name, phone, email, picture, ID documents, car details, ratings and reports.</p>
          <p>
            🧾 Kept without your name: payment records for paid jobs. Other people depend on them, for example a
            driver being paid for a completed trip. Your name, phone, pickup and destination are removed from them.
          </p>
          <p>Unpaid and cancelled requests are removed completely. This cannot be undone.</p>
        </div>

        {blockers.length > 0 ? (
          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <p className="font-bold text-red-700">You cannot delete your account yet</p>
            {blockers.map((b) => (
              <p key={b.code} className="text-sm bg-red-50 border-2 border-red-200 text-red-800 rounded-xl p-3">
                {b.message}
              </p>
            ))}
            <p className="text-xs">Once these are cleared, come back here and the delete button will open.</p>
            <button onClick={recheck} className="w-full bg-white border-2 border-indigo-300 font-bold rounded-xl p-3">
              ↻ Check again
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <p className="text-sm font-semibold">Type DELETE to confirm</p>
            <input
              className="w-full border-2 border-red-200 rounded-xl p-3 uppercase tracking-widest"
              autoComplete="off"
              placeholder="DELETE"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setError("");
              }}
            />
            {hasPassword && (
              <input
                className="w-full border-2 border-indigo-200 rounded-xl p-3"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
              />
            )}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <button
              onClick={remove}
              disabled={busy}
              className="w-full bg-red-600 text-white font-bold rounded-xl p-4 disabled:opacity-60"
            >
              {busy ? "Deleting..." : "🗑 Delete my account permanently"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}