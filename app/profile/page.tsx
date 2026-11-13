"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import PlateBadge from "@/components/PlateBadge";
import Badge from "@/components/Badge";
import { Icon, Num, Tile } from "@/components/AdminUI";
import { useThemePref } from "@/lib/theme";
import { inboxTotal, useInbox } from "@/lib/inbox";
import { formatPlate } from "@/lib/validate";
import { exitApp } from "@/lib/exit";
import Avatar from "@/components/Avatar";

const SUPPORT_EMAIL = "kariukiobadiah655@gmail.com"; // change to your real support email
const THEME_LABEL = { light: "Light", dark: "Dark", system: "Auto" } as const;
const ROLE_LABEL: Record<string, string> = { admin: "Administrator", driver: "Driver", customer: "Customer" };

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
  created_at: string | null;
};
type Stats = { done: number; total: number; avg: number | null; ratings: number };

const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

async function fetchMe(): Promise<Me | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;

  const { data: p } = await supabase
    .from("profiles")
    .select("full_name,phone,role,avatar_url,quote,has_car,car_plate,car_details,created_at")
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
    created_at: p?.created_at ?? null,
  };
}

async function fetchStats(id: string, role: string): Promise<Stats> {
  const empty: Stats = { done: 0, total: 0, avg: null, ratings: 0 };
  if (role !== "driver" && role !== "customer") return empty;

  const col = role === "driver" ? "driver_id" : "customer_id";
  const { data } = await supabase
    .from("bookings")
    .select("price,driver_earnings")
    .eq(col, id)
    .eq("status", "completed")
    .eq("paid", true)
    .limit(1000);
  const rows = (data ?? []) as { price: number; driver_earnings: number | null }[];
  const total = rows.reduce((s, r) => s + Number(role === "driver" ? r.driver_earnings ?? 0 : r.price), 0);

  let avg: number | null = null;
  let ratings = 0;
  if (role === "driver") {
    const { data: r } = await supabase
      .from("driver_ratings")
      .select("avg_rating,rating_count")
      .eq("driver_id", id)
      .maybeSingle();
    if (r) {
      avg = Number(r.avg_rating);
      ratings = r.rating_count;
    }
  }
  return { done: rows.length, total, avg, ratings };
}

const VERIFY: Record<string, { title: string; text: string; cta: string; color: string }> = {
  unsubmitted: {
    title: "Verify your account",
    text: "Upload your ID and driving licence to start accepting jobs.",
    cta: "Upload documents",
    color: "#f59e0b",
  },
  pending: {
    title: "Documents under review",
    text: "We are checking your documents. You can go online as soon as you are approved.",
    cta: "View status",
    color: "#6366f1",
  },
  rejected: {
    title: "Please upload again",
    text: "Your last documents were not accepted. Upload clear photos to try again.",
    cta: "Upload again",
    color: "#dc2626",
  },
};

function Row({
  href,
  icon,
  label,
  hint,
  badge,
  color = "#6366f1",
  danger = false,
  external = false,
  onClick,
  disabled = false,
}: {
  href?: string;
  icon: string;
  label: string;
  hint?: string;
  badge?: number;
  color?: string;
  danger?: boolean;
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const c = danger ? "#dc2626" : color;
  const inner = (
    <>
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${c} 14%, var(--surface))`, color: c }}
      >
        <Icon name={icon} className="w-5 h-5" />
      </span>
      <span className={`flex-1 min-w-0 truncate text-[15px] font-semibold ${danger ? "text-red-600" : ""}`}>{label}</span>
      {hint && <span className="text-xs font-semibold text-indigo-700 shrink-0">{hint}</span>}
      {badge ? <Badge n={badge} /> : null}
      <Icon name="chevron" className="w-4 h-4 text-gray-700" />
    </>
  );
  const cls = "flex items-center gap-3 px-4 min-h-[60px] active:bg-indigo-50 transition-colors";

  if (onClick) {
    return (
      <button onClick={onClick} disabled={disabled} className={`${cls} w-full text-left disabled:opacity-60`}>
        {inner}
      </button>
    );
  }
  if (external) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href as string} className={cls}>
      {inner}
    </Link>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      {title && <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 px-1">{title}</h2>}
      <div className="bg-white rounded-2xl shadow divide-y divide-indigo-100 overflow-hidden">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [exiting, setExiting] = useState(false);
  const themePref = useThemePref();
  const inbox = useInbox();
  const waiting = inbox ? inboxTotal(inbox) : 0;

  useEffect(() => {
    let active = true;
    (async () => {
      const m = await fetchMe();
      if (!active) return;
      if (!m) {
        router.replace("/login");
        return;
      }
      setMe(m);
      const s = await fetchStats(m.id, m.role);
      if (active) setStats(s);
    })().catch(() => {
      if (active) router.replace("/login");
    });
    return () => {
      active = false;
    };
  }, [router]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const exit = async () => {
    setExiting(true);
    const done = await exitApp();
    if (!done) setExiting(false);
  };

  if (!me) return <Loader full />;

  const isAdmin = me.role === "admin";
  const isDriver = me.role === "driver";
  const initial = (me.full_name || me.email || "U").charAt(0).toUpperCase();
  const since = me.created_at
    ? new Date(me.created_at).toLocaleDateString([], { month: "short", year: "numeric" })
    : "-";
  const verify = isDriver && me.verification ? VERIFY[me.verification] : undefined;
  const verified = isDriver && me.verification === "approved";

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-md mx-auto space-y-5 text-gray-900 stagger">
        {/* Header card */}
        <section
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sheen"
          style={{ background: "linear-gradient(135deg,#312e81 0%,#4338ca 50%,#0e7490 100%)" }}
        >
          <div className="flex items-center gap-4">
            <div className="float shrink-0 rounded-full p-1" style={{ background: "rgba(255,255,255,0.25)" }}>
              <Avatar src={me.avatar_url} name={me.full_name || me.email} size={84} ring="#ffffff" />
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-extrabold tracking-tight truncate text-white">{me.full_name || "Your name"}</h1>
              <p className="text-sm text-white/80 truncate">{me.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">{ROLE_LABEL[me.role] ?? me.role}</span>
                {verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/90 text-emerald-950 px-2.5 py-1 text-xs font-bold">
                    <Icon name="check" className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {me.phone && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-white/90">
              <Icon name="phone" className="w-4 h-4" />
              {me.phone}
            </p>
          )}
          {me.quote && <p className="mt-2 text-sm italic text-white/90">“{me.quote}”</p>}

          {!isAdmin &&(
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="rounded-2xl bg-white/15 p-3">
                <p className="text-lg font-extrabold leading-tight">{stats ? <Num value={stats.done} /> : "-"}</p>
                <p className="text-[11px] text-white/80">{isDriver ? "Jobs done" : "Trips"}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3">
                <p className="text-sm font-extrabold leading-tight pt-0.5">
                  {stats ? <Num value={stats.total} prefix="KES " /> : "-"}
                </p>
                <p className="text-[11px] text-white/80">{isDriver ? "Earned" : "Spent"}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3">
                {isDriver ? (
                  <>
                    <p className="text-lg font-extrabold leading-tight">
                      {stats?.avg !== null && stats?.avg !== undefined ? `${stats.avg.toFixed(1)} ★` : "New"}
                    </p>
                    <p className="text-[11px] text-white/80">{stats?.ratings ?? 0} ratings</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-extrabold leading-tight pt-0.5">{since}</p>
                    <p className="text-[11px] text-white/80">Member since</p>
                  </>
                )}
              </div>
            </div>
          )}

          
        </section>

        {/* Driver verification */}
        {verify && (
          <Link
            href="/driver/verify"
            className="slide-in flex items-center gap-3 bg-white rounded-2xl shadow p-4 active:scale-[0.98]"
            style={{ borderLeft: `4px solid ${verify.color}` }}
          >
            <Tile name={me.verification === "pending" ? "clock" : "upload"} color={verify.color} />
            <div className="flex-1 min-w-0">
              <p className="font-bold">{verify.title}</p>
              <p className="text-xs text-gray-700">{verify.text}</p>
            </div>
            <span className="text-xs font-bold" style={{ color: verify.color }}>
              {verify.cta}
            </span>
          </Link>
        )}
        <Card title="Account">
          <Row href="/profile/edit" icon="edit" label="Edit profile" color="#6366f1" />
          {!isAdmin && <Row href="/profile/car" icon="car" label="My vehicle" hint={me.has_car === true ? formatPlate(me.car_plate) : me.has_car === false ? "None" : "Not set"} color="#0ea5e9" />}
          <Row href="/profile/password" icon="lock" label="Change password" color="#8b5cf6" />
          <Row href="/profile/appearance" icon="sun" label="Appearance" hint={THEME_LABEL[themePref]} color="#f59e0b" />
        </Card>

        {isAdmin && (
          <Card title="Administration">
            <Row href="/admin" icon="chart" label="Admin dashboard" badge={waiting} color="#6366f1" />
            <Row href="/admin/notifications" icon="bell" label="Notifications" badge={waiting} color="#06b6d4" />
            <Row href="/admin/stats" icon="trend" label="Overview" color="#10b981" />
          </Card>
        )}

        <Card title="Support">
          <Row href="/report" icon="flag" label="Report a problem" color="#f97316" />
          <Row href={`mailto:${SUPPORT_EMAIL}`} icon="mail" label="Help and support" color="#0ea5e9" external />
          <Row href="/terms" icon="doc" label="Terms of service" color="#64748b" />
          <Row href="/privacy" icon="shield" label="Privacy policy" color="#64748b" />
        </Card>

        <Card>
          <Row onClick={exit} disabled={exiting} icon="power" label={exiting ? "Closing..." : "Exit app"} color="#6366f1" />
          <Row onClick={logout} icon="logout" label="Log out" color="#dc2626" danger />
          {!isAdmin && <Row href="/profile/delete" icon="trash" label="Delete account" danger />}
        </Card>

        <p className="text-center text-xs text-gray-700">KEY AND GO</p>
      </div>
    </main>
  );
}