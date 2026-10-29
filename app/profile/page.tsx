"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import DriverRating from "@/components/DriverRating";

const SUPPORT_EMAIL = "support@example.com"; // change to your real support email

type Me = {
  id: string;
  email: string;
  role: string;
  full_name: string;
  phone: string;
  verification: string | null;
};

async function fetchMe(): Promise<Me | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name,phone,role")
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
    verification,
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");

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
    });
    return () => {
      active = false;
    };
  }, [router]);

  const saveProfile = async () => {
    setMsg("");
    if (!name.trim()) return setMsg("Please enter your name.");
    if (phone.replace(/\D/g, "").length < 9) return setMsg("Please enter a valid phone number.");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: phone.trim() })
      .eq("id", me!.id);
    setMsg(error ? error.message : "Saved ✓");
  };

  const changePassword = async () => {
    setPassMsg("");
    if (newPass.length < 8) return setPassMsg("Password must be at least 8 characters.");
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setPassMsg(error ? error.message : "Password changed ✓");
    if (!error) setNewPass("");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (!me) return <p className="p-6">Loading...</p>;

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4 text-gray-900">
        <div className="bg-white rounded-2xl shadow p-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold">
            {(me.full_name || me.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-lg">{me.full_name || "Your name"}</p>
            <p className="text-sm text-gray-700">{me.email}</p>
            <p className="text-xs font-semibold text-indigo-700 capitalize">{me.role}</p>
          </div>
        </div>

        {me.role === "driver" && (
          <div className="space-y-3">
            <DriverRating driverId={me.id} />
            {me.verification !== "approved" && (
              <Link href="/driver/verify" className="block bg-indigo-600 text-white font-bold rounded-xl p-4 text-center">
                {me.verification === "pending" ? "Documents under review" : "Upload my documents"}
              </Link>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <h2 className="font-bold">Personal details</h2>
          <input className="w-full border-2 border-indigo-200 rounded-lg p-3" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full border-2 border-indigo-200 rounded-lg p-3" type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {msg && <p className="text-sm font-semibold">{msg}</p>}
          <button onClick={saveProfile} className="w-full bg-indigo-600 text-white font-bold rounded-lg p-3">Save changes</button>
        </div>

        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <h2 className="font-bold">Change password</h2>
          <input className="w-full border-2 border-indigo-200 rounded-lg p-3" type="password" autoComplete="new-password" placeholder="New password (min 8 characters)" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          {passMsg && <p className="text-sm font-semibold">{passMsg}</p>}
          <button onClick={changePassword} className="w-full bg-white border-2 border-indigo-300 font-bold rounded-lg p-3">Update password</button>
        </div>

        <div className="bg-white rounded-2xl shadow p-2 text-sm font-semibold">
          {me.role === "admin" && (
            <Link href="/admin" className="block p-3 border-b">Admin panel</Link>
          )}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="block p-3 border-b">Help and support</a>
          <Link href="/terms" className="block p-3 border-b">Terms of service</Link>
          <Link href="/privacy" className="block p-3 border-b">Privacy policy</Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Delete my account`}
            className="block p-3 text-red-600"
          >
            Request account deletion
          </a>
        </div>

        <button onClick={logout} className="w-full bg-white border-2 border-red-300 text-red-700 font-bold rounded-xl p-4">
          Log out
        </button>
      </div>
      <BottomNav />
    </main>
  );
}