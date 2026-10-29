"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Home", paths: ["M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"] },
  { href: "/activity", label: "Activity", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"] },
  { href: "/profile", label: "Profile", paths: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"] },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-indigo-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs font-semibold ${
                active ? "text-indigo-700" : "text-gray-700"
              }`}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill={active ? "#e0e7ff" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {t.paths.map((d) => (
                  <path key={d} d={d} />
                ))}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}