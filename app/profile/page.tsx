"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";
import Loader from "@/components/Loader";
import PlateBadge from "@/components/PlateBadge";
import { useThemePref } from "@/lib/theme";
import Badge from "@/components/Badge";
import { inboxTotal, useInbox } from "@/lib/inbox";
import { formatPlate } from "@/lib/validate";

const SUPPORT_EMAIL = "kariukiobadiah655@gmail.com"; // change to your real support email
const THEME_LABEL = { light: "Light", dark: "Dark", system: "Auto" } as const;

type Me = {
  id: string;
  email: string;
  role: string;
  full_name: string;
  phone: string;
  quote: string;
  avatar_url: string | null;
  has_car: boolean | null;
  car_plate: string | null;
  car_details: string;
  verification: string | null;
};

async function fetchMe(): Promise<Me | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name,phone,role,avatar_url,quote,has_car,car_plate,car_details")
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
    has_car: p?.has_car ?? null,
    car_plate: p?.car_plate ?? null,
    car_details: p?.car_details ?? "",
    verification,
  };
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  
  const themePref = useThemePref();
  const inbox = useInbox();
  const waiting = inbox ? inboxTotal(inbox) : 0;

  useEffect(() => {
    let active = true;
    fetchMe().then((m) => {
      if (!active) return;
      if (!m) router.replace("/login");
      else setMe(m);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };


  if (!me) return <Loader full />;

  const isAdmin = me.role === "admin";
  const row = "flex items-center justify-between p-3 border-b";
  

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-4 text-gray-900 stagger">
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div className="flex items-center gap-4">
            {me.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatar_url} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-indigo-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold">
                {(me.full_name || me.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-lg truncate">{me.full_name || "Your name"}</p>
              <p className="text-sm text-gray-700 truncate">{me.email}</p>
              {me.phone && <p className="text-sm text-gray-700">📞 {me.phone}</p>}
              <p className="text-xs font-semibold text-indigo-700 capitalize">{me.role}</p>
            </div>
          </div>

          {me.has_car === true && (
            <div className="flex items-center gap-2 flex-wrap">
              <PlateBadge plate={me.car_plate} />
              {me.car_details && <span className="text-sm">{me.car_details}</span>}
            </div>
          )}
          {me.has_car === false && <p className="text-sm">🚶 No car</p>}
          {me.quote && <p className="text-sm italic text-gray-800">“{me.quote}”</p>}

          {!isAdmin && (
            <Link href="/profile/edit" className="block text-center bg-indigo-600 text-white font-bold rounded-lg p-3">
              ✏️ Edit profile
            </Link>
          )}
        </div>

        {me.role === "driver" && me.verification !== "approved" && (
          <Link href="/driver/verify" className="block bg-indigo-600 text-white font-bold rounded-xl p-4 text-center">
            {me.verification === "pending" ? "Documents under review" : "Upload my documents"}
          </Link>
        )}

        <div className="bg-white rounded-2xl shadow p-2 text-sm font-semibold">
                   {isAdmin && (
            <>
              <Link href="/admin/notifications" className={row}>
                <span> Notifications</span>
                <span className="flex items-center gap-2">{waiting > 0 && <Badge n={waiting} />}›</span>
              </Link>
              <Link href="/admin" className={row}>
                <span>Admin panel</span>
                <span className="flex items-center gap-2">{waiting > 0 && <Badge n={waiting} />}›</span>
              </Link>
            </>
          )}
          <Link href="/profile/appearance" className={row}>
            <span>Appearance</span>
            <span className="text-indigo-700">{THEME_LABEL[themePref]} ›</span>
          </Link>
                    {!isAdmin && (
            <Link href="/profile/car" className={row}>
              <span>🚗 My car</span>
              <span className="text-indigo-700">
                {me.has_car === true ? formatPlate(me.car_plate) : me.has_car === false ? "No car" : "Not set"} ›
              </span>
            </Link>
          )}
          {!isAdmin && <Link href="/profile/password" className={row}><span>Change password</span><span>›</span></Link>}
          <Link href="/report" className={row}><span>Report a problem</span><span>›</span></Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={row}><span>Help and support</span><span>›</span></a>
          <Link href="/terms" className={row}><span>Terms of service</span><span>›</span></Link>
          <Link href="/privacy" className={isAdmin ? "flex items-center justify-between p-3" : row}>
            <span>Privacy policy</span><span>›</span>
          </Link>
          {!isAdmin && (
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete my account`} className="block p-3 text-red-600">
              Request account deletion
            </a>
          )}
        </div>

        <button onClick={logout} className="w-full bg-white border-2 border-red-300 text-red-700 font-bold rounded-xl p-4">
          Log out
        </button>
        
      </div>
      <BottomNav />
    </main>
  );
}