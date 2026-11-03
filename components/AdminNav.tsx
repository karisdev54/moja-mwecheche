
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Badge from "@/components/Badge";
import { inboxTotal, useInbox } from "@/lib/inbox";

export default function AdminNav() {
  const path = usePathname();
  const i = useInbox();

  const items = [
    { href: "/admin", label: "Verify", n: i?.drivers_pending ?? 0 },
    { href: "/admin/payouts", label: "Payouts", n: i?.owed_drivers ?? 0 },
    { href: "/admin/refunds", label: "Refunds", n: i?.refunds_count ?? 0 },
    { href: "/admin/reports", label: "Reports", n: i?.reports_open ?? 0 },
    { href: "/admin/stats", label: "Overview", n: 0 },
    { href: "/admin/notifications", label: "Alerts", n: i ? inboxTotal(i) : 0 },
  ];

  const row =
    "flex w-full items-center justify-between p-3 border-b border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors";

  return (
    <div className="w-full flex flex-col">
      {items.map((it) => {
        const active = path === it.href;

        return (
          <Link
            key={it.href}
            href={it.href}
            className={`${row} ${
              active
                ? "bg-indigo-50 text-indigo-700 font-bold"
                : "text-gray-800"
            }`}
          >
            <span>{it.label}</span>

            <span className="flex items-center gap-3">
              {it.n > 0 && <Badge n={it.n} />}
              <span className="text-gray-400 text-lg">›</span>
            </span>
          </Link>
        );
      })}

      <Link
        href="/dashboard"
        className={`${row} text-gray-800`}
      >
        <span>Back to map</span>
        <span className="text-gray-400 text-lg color-blue semi-bold">›</span>
      </Link>
    </div>
  );
}
