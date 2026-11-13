"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import AdminNav from "@/components/AdminNav";
import { Empty, Icon, PageHeader, Pill, Stat } from "@/components/AdminUI";
import { alertDialog, confirmDialog } from "@/lib/dialog";
import { friendlyError } from "@/lib/net";
import { toast } from "@/lib/toast";

type Admin = { id: string; full_name: string | null; email: string | null; created_at: string; last_sign_in_at: string | null };
type State = { allowed: boolean; me: string; admins: Admin[] };

const FIELD =
  "w-full border-2 border-indigo-200 rounded-xl p-3 pl-12 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function generate(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const a = new Uint32Array(16);
  crypto.getRandomValues(a);
  const out = Array.from(a, (n) => chars[n % chars.length]);
  out[4] = digits[a[4] % digits.length];
  out[11] = digits[a[11] % digits.length];
  return out.join("");
}

async function fetchTeam(): Promise<State> {
  const none: State = { allowed: false, me: "", admins: [] };
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return none;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (p?.role !== "admin") return none;
  const { data } = await supabase.rpc("admin_list_admins");
  return { allowed: true, me: u.user.id, admins: (data ?? []) as Admin[] };
}

function Field({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 w-12 flex items-center justify-center text-indigo-500 pointer-events-none">
        <Icon name={icon} className="w-5 h-5" />
      </span>
      {children}
    </div>
  );
}

export default function TeamPage() {
  const [state, setState] = useState<State | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let active = true;
    fetchTeam().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const create = async () => {
    if (busy) return;
    setMsg("");
    if (name.trim().length < 2) return setMsg("Enter the person's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setMsg("Enter a valid email address.");
    if (password.length < 10 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
      return setMsg("The password needs at least 10 characters, with letters and numbers.");
    }

    const ok = await confirmDialog({
      title: "Add this admin?",
      message: `${email.trim()} will be able to approve drivers, move money and suspend accounts.`,
      confirmText: "Add admin",
    });
    if (!ok) return;

    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token}` },
      body: JSON.stringify({ name, email, password }),
    }).catch(() => null);
    setBusy(false);

    if (!res) return setMsg("Network error. Check your internet connection and try again.");
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return setMsg(friendlyError(json.error ?? "Could not add the admin."));

    toast("Admin added. Share the password privately.", { tone: "ok", ms: 5000 });
    setName("");
    setEmail("");
    setPassword("");
    setShow(false);
    fetchTeam().then(setState);
  };

  const remove = async (a: Admin) => {
    const ok = await confirmDialog({
      title: `Remove ${a.full_name || "this admin"}?`,
      message: "They lose admin access and their account is suspended. You can reinstate it later from Users.",
      confirmText: "Remove admin",
      danger: true,
    });
    if (!ok) return;
    setRemoving(a.id);
    const { error } = await supabase.rpc("admin_demote", { p_user: a.id });
    setRemoving(null);
    if (error) {
      await alertDialog({ title: "Could not remove", message: error.message });
      return;
    }
    toast("Admin removed", { tone: "warn" });
    fetchTeam().then(setState);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast("Password copied", { tone: "ok", ms: 2000 });
    } catch {
      toast("Could not copy", { tone: "warn", ms: 2000 });
    }
  };

  if (!state) return <Loader full />;
  if (!state.allowed) {
    return (
      <p className="p-6">
        Not authorized. <Link href="/login" className="underline">Log in as admin</Link>
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">
        <PageHeader title="Admin team" subtitle="Add and remove people who can manage the platform" />
        <AdminNav />

        <div className="grid grid-cols-2 gap-3">
          <Stat icon="users" color="#8b5cf6" label="Admins" value={state.admins.length} />
          <Stat icon="shield" color="#059669" label="Signed in as you" value={1} />
        </div>

        <section className="bg-white rounded-2xl shadow p-4 space-y-4">
          <div>
            <h2 className="font-bold">Add an admin</h2>
            <p className="text-xs text-gray-700">They can log in straight away with this email and password.</p>
          </div>

          <Field icon="user">
            <input className={FIELD} placeholder="Full name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field icon="mail">
            <input className={FIELD} type="email" inputMode="email" autoCapitalize="none" autoComplete="off" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <div className="space-y-2">
            <Field icon="lock">
              <input
                className={`${FIELD} pr-12`}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Password (10+ characters, letters and numbers)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 w-12 flex items-center justify-center text-gray-700 active:scale-90"
              >
                <Icon name={show ? "eyeoff" : "eye"} className="w-5 h-5" />
              </button>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPassword(generate());
                  setShow(true);
                }}
                className="flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 font-bold rounded-xl p-2.5 text-sm active:scale-95"
              >
                <Icon name="lock" className="w-4 h-4" />
                Generate strong
              </button>
              <button
                type="button"
                onClick={copy}
                disabled={!password}
                className="flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 font-bold rounded-xl p-2.5 text-sm disabled:opacity-50 active:scale-95"
              >
                <Icon name="copy" className="w-4 h-4" />
                Copy password
              </button>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-xl bg-indigo-50 p-3 text-xs text-gray-800">
            <span className="text-indigo-600 mt-0.5">
              <Icon name="info" className="w-4 h-4" />
            </span>
            Send the password by a private channel, and ask them to change it from Profile, Change password, after their first login.
          </p>

          {msg && (
            <p className="slide-in flex items-start gap-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold p-3">
              <Icon name="alert" className="w-4 h-4 mt-0.5" />
              {msg}
            </p>
          )}

          <button
            onClick={create}
            disabled={busy}
            className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-3.5 shadow-lg disabled:opacity-60 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {busy && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            {busy ? "Creating..." : "Add admin"}
          </button>
        </section>

        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">Current admins</h2>
        {state.admins.length === 0 && <Empty icon="users" title="No admins found" text="Something is wrong. Check the database." />}

        {state.admins.map((a) => {
          const mine = a.id === state.me;
          return (
            <article key={a.id} className="bg-white rounded-2xl shadow p-4 flex items-center gap-3">
              <span className="w-11 h-11 rounded-full flex items-center justify-center text-base font-extrabold text-white shrink-0" style={{ background: "#8b5cf6" }}>
                {(a.full_name || a.email || "?").trim().charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold truncate">{a.full_name || "Admin"}</p>
                  {mine && <Pill text="You" color="#4338ca" />}
                </div>
                <p className="text-xs text-gray-700 truncate">{a.email}</p>
                <p className="text-[11px] text-gray-700">
                  {a.last_sign_in_at ? `Last sign-in ${new Date(a.last_sign_in_at).toLocaleDateString()}` : "Has not signed in yet"}
                </p>
              </div>
              {!mine && (
                <button
                  onClick={() => remove(a)}
                  disabled={removing === a.id}
                  aria-label={`Remove ${a.full_name ?? "admin"}`}
                  className="w-10 h-10 rounded-full bg-white border-2 border-red-200 text-red-600 flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-90"
                >
                  <Icon name="ban" className="w-4 h-4" />
                </button>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}