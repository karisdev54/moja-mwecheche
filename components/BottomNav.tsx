"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Badge from "@/components/Badge";
import { inboxTotal, useInbox } from "@/lib/inbox";
import { useRole } from "@/lib/role";

type Tab = { href: string; label: string; paths: string[]; alerts?: boolean };

const PROFILE = ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"];

const USER_TABS: Tab[] = [
  { href: "/dashboard", label: "Home", paths: ["M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"] },
  { href: "/activity", label: "Activity", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"] },
  { href: "/profile", label: "Profile", paths: PROFILE },
];

const ADMIN_TABS: Tab[] = [
  { href: "/admin", label: "Overview", paths: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"] },
  { href: "/admin/live", label: "Live map", paths: ["M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"] },
  { href: "/admin/notifications", label: "Activity", alerts: true, paths: ["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"] },
  { href: "/profile", label: "Profile", paths: PROFILE },
];

function NavBar({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  const inbox = useInbox();
  const waiting = inbox ? inboxTotal(inbox) : 0;
  const idx = Math.max(0, tabs.findIndex((t) => t.href === pathname));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass border-t pb-[env(safe-area-inset-bottom)]">
      <div
        className="relative max-w-md mx-auto grid px-2 py-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-2xl bg-indigo-100 transition-transform duration-300 ease-out"
          style={{ left: 8, width: `calc((100% - 16px) / ${tabs.length})`, transform: `translateX(${idx * 100}%)` }}
        />
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative z-10 flex flex-col items-center gap-0.5 py-2 text-xs font-semibold active:scale-95 transition-transform ${
                active ? "text-indigo-700" : "text-gray-700"
              }`}
            >
              <span className="relative">
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: "block" }}
                >
                  {t.paths.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
                {t.alerts && waiting > 0 && (
                  <span className="absolute -top-1.5 -right-3">
                    <Badge n={waiting} />
                  </span>
                )}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const role = useRole();

  const adminHrefs = ADMIN_TABS.map((t) => t.href);
  const userHrefs = USER_TABS.map((t) => t.href);

  let tabs: Tab[] | null = null;
  if (role === "admin") {
    tabs = adminHrefs.includes(pathname) ? ADMIN_TABS : null;
  } else if (role) {
    tabs = userHrefs.includes(pathname) ? USER_TABS : null;
  } else if (pathname.startsWith("/admin")) {
    tabs = adminHrefs.includes(pathname) ? ADMIN_TABS : null; // role still loading
  } else if (pathname === "/dashboard" || pathname === "/activity") {
    tabs = USER_TABS;
  }

  if (!tabs) return null;
  return <NavBar tabs={tabs} pathname={pathname} />;
}