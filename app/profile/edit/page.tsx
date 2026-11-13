"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AvatarEditor from "@/components/AvatarEditor";
import Loader from "@/components/Loader";
import { Icon, PageHeader } from "@/components/AdminUI";
import { cleanName, friendlyDbError, nameProblem, normalizePhone } from "@/lib/validate";
import { toast } from "@/lib/toast";

function Field({ icon, label, hint, children }: { icon: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-700">{label}</p>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 w-12 flex items-center justify-center text-indigo-500 pointer-events-none">
          <Icon name={icon} className="w-5 h-5" />
        </span>
        {children}
      </div>
      {hint && <p className="text-xs text-gray-700">{hint}</p>}
    </div>
  );
}

const INPUT = "w-full border-2 border-indigo-200 rounded-xl p-3 pl-12 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

export default function EditProfilePage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState("customer");
  const [initial, setInitial] = useState("?");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quote, setQuote] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        router.replace("/login");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name,phone,quote,avatar_url,role")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!active) return;
      setUid(u.user.id);
      setRole(p?.role ?? "customer");
      setInitial((p?.full_name || u.user.email || "?").charAt(0).toUpperCase());
      setName(p?.full_name ?? "");
      setPhone(p?.phone ?? "");
      setQuote(p?.quote ?? "");
      setAvatar(p?.avatar_url ?? null);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  // The cropper already gives us a 512x512 JPEG
  const onAvatar = async (file: File) => {
    if (!uid) return;
    setAvatarMsg("");
    setAvatarBusy(true);
    const path = `${uid}/avatar.jpg`;
    const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) {
      setAvatarMsg(up.error.message);
      setAvatarBusy(false);
      return;
    }
    const url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
    setAvatarBusy(false);
    if (error) return setAvatarMsg(error.message);
    setAvatar(url);
    toast("Picture updated", { tone: "ok" });
  };

  const save = async () => {
    if (!uid || busy) return;
    setMsg("");
    const isAdmin = role === "admin";

    const nErr = isAdmin ? (name.trim() ? null : "Enter your name.") : nameProblem(name);
    if (nErr) return setMsg(nErr);

    const typed = phone.trim();
    const pNorm = typed ? normalizePhone(typed) : null;
    if (typed && !pNorm) return setMsg("Enter a valid Kenyan number, e.g. 0712 345 678.");
    if (!typed && !isAdmin) return setMsg("Enter your phone number.");

    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: cleanName(name), phone: pNorm, quote: quote.trim() || null })
      .eq("id", uid);
    setBusy(false);
    if (error) return setMsg(friendlyDbError(error.message, error.code));
    toast("Profile saved", { tone: "ok" });
    router.push("/profile");
  };

  if (!loaded) return <Loader full />;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
        <PageHeader title="Edit profile" subtitle="Update your details and picture" href="/profile" />

        <section
          className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl sheen flex flex-col items-center gap-3"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <div className="rounded-full p-1" style={{ background: "rgba(255,255,255,0.25)" }}>
            <AvatarEditor src={avatar} initial={initial} busy={avatarBusy} onFile={onAvatar} size={112} />
          </div>
          <p className="text-sm text-white/90">Tap your picture to change it</p>
          {avatarMsg && <p className="text-sm font-semibold text-amber-200">{avatarMsg}</p>}
        </section>

        <section className="bg-white rounded-2xl shadow p-4 space-y-4">
          <Field icon="user" label="Full name" hint={role === "admin" ? undefined : "First and last name"}>
            <input className={INPUT} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field icon="phone" label={role === "admin" ? "Phone (optional)" : "Phone"} hint="Saved in one standard format">
            <input
              className={INPUT}
              type="tel"
              inputMode="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field icon="edit" label="About you" hint="A short line, up to 140 characters">
            <input
              className={INPUT}
              maxLength={140}
              placeholder="A short line about you (optional)"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
            />
          </Field>
        </section>

        {msg && (
          <p className="slide-in flex items-center gap-2 bg-white rounded-2xl shadow p-3 text-sm font-semibold text-red-700" style={{ borderLeft: "4px solid #dc2626" }}>
            <Icon name="alert" className="w-4 h-4 shrink-0" />
            {msg}
          </p>
        )}

        <button
          onClick={save}
          disabled={busy}
          className="btn-shine grad-bg w-full text-white font-bold rounded-2xl p-4 shadow-xl active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>
    </main>
  );
}