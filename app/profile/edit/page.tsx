"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AvatarEditor from "@/components/AvatarEditor";
import Loader from "@/components/Loader";
import { cleanName, friendlyDbError, nameProblem, normalizePhone } from "@/lib/validate";

export default function EditProfilePage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
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
      if (p?.role === "admin") {
        router.replace("/profile");
        return;
      }
      setUid(u.user.id);
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
    setAvatarMsg("Picture updated ✓");
  };

  const save = async () => {
    if (!uid || busy) return;
    setMsg("");
    const nErr = nameProblem(name);
    if (nErr) return setMsg(nErr);
    const pNorm = normalizePhone(phone);
    if (!pNorm) return setMsg("Enter a valid Kenyan number, e.g. 0712 345 678.");

    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: cleanName(name), phone: pNorm, quote: quote.trim() || null })
      .eq("id", uid);
    setBusy(false);
    if (error) return setMsg(friendlyDbError(error.message, error.code));
    router.push("/profile");
  };

  if (!loaded) return <Loader full />;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="max-w-md mx-auto space-y-4 text-gray-900 stagger">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Edit profile</h1>
          <Link href="/profile" className="text-sm underline font-semibold">Cancel</Link>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 flex flex-col items-center gap-2">
          <AvatarEditor src={avatar} initial={initial} busy={avatarBusy} onFile={onAvatar} size={96} />
          {avatarMsg && <p className="text-sm font-semibold">{avatarMsg}</p>}
        </div>

        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <input className="w-full border-2 border-indigo-200 rounded-lg p-3" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full border-2 border-indigo-200 rounded-lg p-3" type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <textarea className="w-full border-2 border-indigo-200 rounded-lg p-3" rows={2} maxLength={140} placeholder="A short line about you (optional)" value={quote} onChange={(e) => setQuote(e.target.value)} />
        </div>

        {msg && <p className="text-red-600 text-sm font-semibold">{msg}</p>}
        <button onClick={save} disabled={busy} className="w-full bg-indigo-600 text-white font-bold rounded-xl p-4 disabled:opacity-60">
          {busy ? "Saving..." : "Save changes"}
        </button>
      </div>
    </main>
  );
}