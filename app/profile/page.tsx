"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import AvatarEditor from "@/components/AvatarEditor";
import PasswordChange from "@/components/PasswordChange";
import InstallButton from "@/components/InstallButton";

const SUPPORT_EMAIL = "kariukiobadiah655@gmail.com"; // change to your real support email

type Me = {
  id: string;
  email: string;
  role: string;
  full_name: string;
  phone: string;
  quote: string;
  avatar_url: string | null;
  verification: string | null;
};

async function fetchMe(): Promise<Me | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name,phone,role,avatar_url,quote")
    .eq("id", u.user.id)
    .maybeSingle();
  let verification: string | null = null;
  if (p?.role === "driver") {
    const { data: d } = await supabase
      .from("drivers")
      .select("verification_status")
      .eq("id", u.user.id)
      .maybeSingle();
    verification = d?.verification_status ?? null;
  }
  return {
    id: u.user.id,
    email: u.user.email ?? "",
    role: p?.role ?? "customer",
    full_name: p?.full_name ?? "",
    phone: p?.phone ?? "",
    quote: p?.quote ?? "",
    avatar_url: p?.avatar_url ?? null,
    verification,
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quote, setQuote] = useState("");
  const [msg, setMsg] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");

  useEffect(() => {
    let active = true;
    fetchMe().then((m) => {
      if (!active) return;
      if (!m) {
        router.replace("/login");
        return;
      }
      setMe(m);
      setName(m.full_name);
      setPhone(m.phone);
      setQuote(m.quote);
      setAvatar(m.avatar_url);
    });
    return () => {
      active = false;
    };
  }, [router]);

  // The cropper already gives us a 512x512 JPEG, so we upload it as it is
  const onAvatar = async (file: File) => {
    if (!me) return;
    setAvatarMsg("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarMsg("Please use a JPG, PNG or WebP photo.");
      return;
    }

    setAvatarBusy(true);
    const path = `${me.id}/avatar.jpg`;
    const up = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) {
      setAvatarMsg(up.error.message);
      setAvatarBusy(false);
      return;
    }

    // The ?v= part makes the phone show the new picture instead of the cached one
    const url = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", me.id);
    setAvatarBusy(false);
    if (error) {
      setAvatarMsg(error.message);
      return;
    }
    setAvatar(url);
    setAvatarMsg("Picture updated ✓");
  };

  const saveProfile = async () => {
    setMsg("");
    if (!name.trim()) return setMsg("Please enter your name.");
    if (phone.replace(/\D/g, "").length < 9) return setMsg("Please enter a valid phone number.");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: phone.trim(), quote: quote.trim() || null })
      .eq("id", me!.id);
    setMsg(error ? error.message : "Saved ✓");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (!me) return <p className="p-6">Loading...</p>;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4 text-gray-900">
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="flex items-center gap-4">
            <AvatarEditor
              src={avatar}
              initial={(me.full_name || me.email).charAt(0).toUpperCase()}
              busy={avatarBusy}
              onFile={onAvatar}
            />
            <div className="min-w-0">
              <p className="font-bold text-lg truncate">{me.full_name || "Your name"}</p>
              <p className="text-sm text-gray-700 truncate">{me.email}</p>
              <p className="text-xs font-semibold text-indigo-700 capitalize">{me.role}</p>
            </div>
          </div>
          {quote && <p className="text-sm italic text-gray-800">“{quote}”</p>}
          {avatarMsg && <p className="text-sm font-semibold">{avatarMsg}</p>}
        </div>

        {me.role === "driver" && me.verification !== "approved" && (
          <Link href="/driver/verify" className="block bg-indigo-600 text-white font-bold rounded-xl p-4 text-center">
            {me.verification === "pending" ? "Documents under review" : "Upload my documents"}
          </Link>
        )}

        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <h2 className="font-bold">Personal details</h2>
          <input
            className="w-full border-2 border-indigo-200 rounded-lg p-3"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full border-2 border-indigo-200 rounded-lg p-3"
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <textarea
            className="w-full border-2 border-indigo-200 rounded-lg p-3"
            rows={2}
            maxLength={140}
            placeholder="A short line about you (optional)"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
          />
          {msg && <p className="text-sm font-semibold">{msg}</p>}
          <button onClick={saveProfile} className="w-full bg-indigo-600 text-white font-bold rounded-lg p-3">
            Save changes
          </button>
        </div>
        <InstallButton />

        <PasswordChange email={me.email} />

        <div className="bg-white rounded-2xl shadow p-2 text-sm font-semibold">
          {me.role === "admin" && (
            <Link href="/admin" className="block p-3 border-b">
              Admin panel
            </Link>
          )}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="block p-3 border-b">
            Help and support
          </a>
          <Link href="/terms" className="block p-3 border-b">
            Terms of service
          </Link>
          <Link href="/privacy" className="block p-3 border-b">
            Privacy policy
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete my account`} className="block p-3 text-red-600">
            Request account deletion
          </a>
        </div>

        <button
          onClick={logout}
          className="w-full bg-white border-2 border-red-300 text-red-700 font-bold rounded-xl p-4"
        >
          Log out
        </button>
      </div>
      <BottomNav />
    </main>
  );
}