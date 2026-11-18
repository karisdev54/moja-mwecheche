"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import { Icon } from "@/components/AdminUI";
import { inboxTotal, useInbox, type Inbox } from "@/lib/inbox";
import { useRole } from "@/lib/role";

/* ---------- Remember whether the menu is hidden, on this device ---------- */
const KEY = "admin-menu-hidden";
let hiddenPref = false;
let loaded = false;
const subs = new Set<() => void>();

function readHidden() {
  if (!loaded && typeof window !== "undefined") {
    try {
      hiddenPref = window.localStorage.getItem(KEY) === "1";
    } catch {
      // storage blocked: the menu simply starts visible each time
    }
    loaded = true;
  }
  return hiddenPref;
}
function writeHidden(v: boolean) {
  hiddenPref = v;
  loaded = true;
  try {
    window.localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    // storage blocked
  }
  subs.forEach((f) => f());
}
function subscribeHidden(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

/* ---------- Every admin page ---------- */
type Item = { href: string; label: string; icon: string; count?: (i: Inbox) => number };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: "chart" },
      { href: "/admin/live", label: "Live map", icon: "pin" },
      { href: "/admin/notifications", label: "Activity", icon: "bell", count: inboxTotal },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/verification", label: "Verify drivers", icon: "verify", count: (i) => i.drivers_pending ?? 0 },
      { href: "/admin/vehicles", label: "Vehicles", icon: "car", count: (i) => i.cars_pending ?? 0 },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/bookings", label: "Bookings", icon: "list" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/admin/payouts", label: "Payouts", icon: "wallet", count: (i) => i.payout_requests ?? 0 },
      { href: "/admin/refunds", label: "Refunds", icon: "refund", count: (i) => i.refunds_count ?? 0 },
      { href: "/admin/reconcile", label: "Money check", icon: "check", count: (i) => i.recon_issues ?? 0 },
      { href: "/admin/stats", label: "Revenue", icon: "trend" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/admin/reports", label: "Reports", icon: "flag", count: (i) => i.reports_open ?? 0 },
      { href: "/admin/team", label: "Admin team", icon: "shield" },
    ],
  },
];

function NavList({ path, inbox, onNavigate }: { path: string; inbox: Inbox | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin menu" className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
      {GROUPS.map((g) => (
        <div key={g.title} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-700">{g.title}</p>
          {g.items.map((it) => {
            const active = path === it.href;
            const n = inbox && it.count ? it.count(inbox) : 0;
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors duration-200 active:scale-[0.98] ${
                  active ? "bg-indigo-600 text-white shadow" : "text-gray-900 hover:bg-indigo-50"
                }`}
              >
                <Icon name={it.icon} className="w-5 h-5" />
                <span className="flex-1">{it.label}</span>
                {n > 0 &&
                  (active ? (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-white text-indigo-700 text-xs font-bold inline-flex items-center justify-center">
                      {n > 99 ? "99+" : n}
                    </span>
                  ) : (
                    <Badge n={n} />
                  ))}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Footer({
  me,
  onNavigate,
  onLogout,
}: {
  me: { name: string | null; avatar: string | null };
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="border-t border-indigo-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-1">
      <Link
        href="/profile"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl p-2 hover:bg-indigo-50 transition-colors duration-200 active:scale-[0.98]"
      >
        <Avatar src={me.avatar} name={me.name} size={40} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-bold truncate">{me.name || "Administrator"}</span>
          <span className="block text-xs text-gray-700">Profile and settings</span>
        </span>
        <Icon name="chevron" className="w-4 h-4 text-gray-700" />
      </Link>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-red-600 hover:bg-red-50 transition-colors duration-200 active:scale-[0.98]"
      >
        <Icon name="logout" className="w-5 h-5" />
        Log out
      </button>
    </div>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const role = useRole();
  const inbox = useInbox();
  const hidden = useSyncExternalStore(subscribeHidden, readHidden, () => false);
  const [drawer, setDrawer] = useState(false);
  const [me, setMe] = useState<{ name: string | null; avatar: string | null }>({ name: null, avatar: null });

  useEffect(() => {
    if (role !== "admin") return;
    let active = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name,avatar_url")
        .eq("id", s.session.user.id)
        .maybeSingle();
      if (active && data) setMe({ name: data.full_name, avatar: data.avatar_url });
    })();
    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  // Anyone who is not an admin just sees the page itself, which says "Not authorized"
  if (role !== "admin") return <>{children}</>;

  const total = inbox ? inboxTotal(inbox) : 0;
  const current = GROUPS.flatMap((g) => g.items).find((i) => i.href === path)?.label ?? "Admin";

  return (
    <div className="admin-shell min-h-screen" data-hidden={hidden}>
      {/* Phone: top bar with a menu button */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 glass border-b border-indigo-100 flex items-center gap-3 px-3 pt-[env(safe-area-inset-top)] h-[var(--bar)]">
        <button
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
          className="relative w-10 h-10 rounded-xl bg-white shadow flex items-center justify-center active:scale-90 transition-transform"
        >
          <Icon name="menu" className="w-5 h-5" />
          {total > 0 && (
            <span className="absolute -top-1.5 -right-1.5">
              <Badge n={total} />
            </span>
          )}
        </button>
        <p className="flex-1 min-w-0 text-base font-extrabold tracking-tight truncate">{current}</p>
        <Link href="/profile" aria-label="My profile">
          <Avatar src={me.avatar} name={me.name} size={36} />
        </Link>
      </header>

      {/* Phone: drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${drawer ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!drawer}
        inert={!drawer}
      >
        <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
        <aside
          role="dialog"
          aria-label="Admin menu"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
            drawer ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 border-b border-indigo-100">
            <div className="leading-tight">
              <p className="text-base font-extrabold tracking-tight">KEY AND GO</p>
              <p className="text-[11px] font-semibold text-gray-700">Admin</p>
            </div>
            <button
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-indigo-50 transition-colors active:scale-90"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
          <NavList path={path} inbox={inbox} onNavigate={() => setDrawer(false)} />
          <Footer me={me} onNavigate={() => setDrawer(false)} onLogout={logout} />
        </aside>
      </div>

      {/* Computer: fixed menu that can be hidden */}
      <aside
        aria-hidden={hidden}
        inert={hidden}
        className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-white border-r border-indigo-100 shadow-sm transition-transform duration-300 ease-out"
        style={{ transform: hidden ? "translateX(-100%)" : "translateX(0)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 h-16 border-b border-indigo-100">
          <Link href="/admin" className="min-w-0 leading-tight">
            <span className="block text-base font-extrabold tracking-tight">KEY AND GO</span>
            <span className="block text-[11px] font-semibold text-gray-700">Admin</span>
          </Link>
          <button
            onClick={() => writeHidden(true)}
            aria-label="Hide menu"
            title="Hide menu"
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-indigo-50 transition-colors active:scale-90"
          >
            <Icon name="sidebar" className="w-5 h-5" />
          </button>
        </div>
        <NavList path={path} inbox={inbox} />
        <Footer me={me} onLogout={logout} />
      </aside>

      {hidden && (
        <button
          onClick={() => writeHidden(false)}
          aria-label="Show menu"
          title="Show menu"
          className="pop-in hidden lg:flex fixed top-3 left-3 z-40 w-11 h-11 rounded-xl bg-white shadow-lg items-center justify-center active:scale-90 transition-transform"
        >
          <Icon name="menu" className="w-5 h-5" />
          {total > 0 && (
            <span className="absolute -top-1.5 -right-1.5">
              <Badge n={total} />
            </span>
          )}
        </button>
      )}

      <div className="pt-[var(--bar)] lg:pl-[var(--side)] transition-[padding] duration-300 ease-out">{children}</div>
    </div>
  );
}