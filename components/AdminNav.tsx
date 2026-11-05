"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Badge from "@/components/Badge";
import { inboxTotal, useInbox } from "@/lib/inbox";

export default function AdminNav() {
  const path = usePathname();
  const i = useInbox();

  const items = [
    { href: "/admin", label: "Home", n: 0 },
    { href: "/admin/verification", label: "Verify", n: i?.drivers_pending ?? 0 },
    { href: "/admin/users", label: "Users", n: 0 },
    { href: "/admin/bookings", label: "Bookings", n: 0 },
    { href: "/admin/payouts", label: "Payouts", n: i?.owed_drivers ?? 0 },
    { href: "/admin/refunds", label: "Refunds", n: i?.refunds_count ?? 0 },
    { href: "/admin/reports", label: "Reports", n: i?.reports_open ?? 0 },
    { href: "/admin/stats", label: "Overview", n: 0 },
    { href: "/admin/notifications", label: "Alerts", n: i ? inboxTotal(i) : 0 },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((it) => {
        const active = path === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${
              active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-indigo-200"
            }`}
          >
            {it.label}
            {it.n > 0 && <Badge n={it.n} />}
          </Link>
        );
      })}
      <Link href="/dashboard" className="inline-flex shrink-0 items-center rounded-full border-2 border-indigo-200 bg-white px-3 py-1.5 text-sm font-semibold">
        Back to map
      </Link>
    </div>
  );
}