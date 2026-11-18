"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import { Icon, PageHeader, Tile } from "@/components/AdminUI";
import { confirmDialog } from "@/lib/dialog";
import { friendlyError } from "@/lib/net";

type Blocker = { code: string; message: string };

const ERASED = ["Your login, name, phone and email", "Your profile picture and car details", "Your ID documents and vehicle documents", "Your ratings and reports"];

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

      const { data: b } = await supabase.rpc("my_delete_blockers");
      const { data: has } = await supabase.rpc("my_has_password");
      if (!active) return;
      setHasPassword(has === true);
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
      message: "This cannot be undone. Your profile, photos, documents and car details will be erased, and you will be signed out.",
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
    }).catch(() => null);
    setBusy(false);

    if (!res) return setError("Network error. Check your internet connection and try again.");
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(friendlyError(json.error ?? "Could not delete the account."));
      if (res.status === 409) recheck();
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/goodbye?deleted=1");
  };

  if (!ready) return <Loader full />;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
        <PageHeader title="Delete account" subtitle="Remove your account and personal details" href="/profile" back="Profile" />

        <section className="bg-white rounded-2xl shadow p-4 space-y-4">
          <div className="flex items-start gap-3">
            <Tile name="trash" color="#dc2626" />
            <div>
              <p className="font-bold">What gets erased</p>
              <ul className="mt-2 grid gap-1.5">
                {ERASED.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm">
                    <span className="text-red-600">
                      <Icon name="close" className="w-3.5 h-3.5" size={14} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-indigo-50 border border-indigo-100 p-3">
            <span className="text-indigo-600 mt-0.5">
              <Icon name="receipt" className="w-5 h-5" />
            </span>
            <div className="text-sm">
              <p className="font-bold">What is kept, without your name</p>
              <p className="text-gray-800 mt-0.5">
                Payment records for paid trips, because other people depend on them. For example, a driver being paid for a completed trip. Your name, phone, pickup and destination are removed from them.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-700">Unpaid and cancelled requests are removed completely. This cannot be undone.</p>
        </section>

        {blockers.length > 0 ? (
          <section className="bg-white rounded-2xl shadow p-4 space-y-3" style={{ borderLeft: "4px solid #dc2626" }}>
            <p className="flex items-center gap-2 font-bold text-red-700">
              <Icon name="alert" className="w-5 h-5" />
              You cannot delete your account yet
            </p>
            {blockers.map((b) => (
              <p key={b.code} className="text-sm bg-red-50 border border-red-200 text-red-800 rounded-xl p-3">
                {b.message}
              </p>
            ))}
            <p className="text-xs text-gray-700">Once these are cleared, come back here and the delete button will open.</p>
            <button onClick={recheck} className="w-full flex items-center justify-center gap-2 bg-white border-2 border-indigo-300 font-bold rounded-xl p-3 active:scale-[0.98]">
              <Icon name="undo" className="w-4 h-4" />
              Check again
            </button>
          </section>
        ) : (
          <section className="bg-white rounded-2xl shadow p-4 space-y-3">
            <p className="text-sm font-bold">Type DELETE to confirm</p>
            <input
              className="w-full border-2 border-red-200 rounded-xl p-3 uppercase tracking-widest focus:border-red-500 focus:ring-4 focus:ring-red-100"
              autoComplete="off"
              placeholder="DELETE"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setError("");
              }}
            />
            {hasPassword && (
              <div className="relative">
                <span className="absolute inset-y-0 left-0 w-12 flex items-center justify-center text-indigo-500 pointer-events-none">
                  <Icon name="lock" className="w-5 h-5" />
                </span>
                <input
                  className="w-full border-2 border-indigo-200 rounded-xl p-3 pl-12 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                />
              </div>
            )}
            {error && (
              <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
                <Icon name="alert" className="w-4 h-4 mt-0.5" />
                {error}
              </p>
            )}
            <button
              onClick={remove}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold rounded-xl p-4 disabled:opacity-60 active:scale-[0.98]"
            >
              {busy ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <Icon name="trash" className="w-5 h-5" />
              )}
              {busy ? "Deleting..." : "Delete my account permanently"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}