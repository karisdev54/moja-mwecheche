"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { inboxTotal, useInbox } from "@/lib/inbox";

const TABS = [
  { href: "/dashboard", label: "Home", paths: ["M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"] },
  { href: "/activity", label: "Activity", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"] },
  { href: "/profile", label: "Profile", paths: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"] },
];

function NavBar({ pathname }: { pathname: string }) {
  const inbox = useInbox();
  const waiting = inbox ? inboxTotal(inbox) > 0 : false;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass border-t pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex px-2 py-1">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <motion.div key={t.href} whileTap={{ scale: 0.9 }} className="flex-1">
              <Link
                href={t.href}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${
                  active ? "text-indigo-700" : "text-gray-700"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-x-3 inset-y-1 rounded-2xl bg-indigo-100"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <svg
                  className="relative"
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {t.paths.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </svg>
                <span className="relative">{t.label}</span>
                {t.href === "/profile" && waiting && (
                  <span className="absolute top-1.5 left-1/2 ml-2 w-3 h-3 rounded-full bg-red-600 border-2 border-white" />
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  if (!TABS.some((t) => t.href === pathname)) return null;
  return <NavBar pathname={pathname} />;
}