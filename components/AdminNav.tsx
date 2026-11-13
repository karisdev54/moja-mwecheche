
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { inboxTotal, useInbox } from "@/lib/inbox";
import Badge from "@/components/Badge";

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const inbox = useInbox();

  const tools = [
    {
      href: "/admin/verification",
      title: "Driver verification",
      sub: "Review documents and approve drivers",
      n: inbox?.drivers_pending ?? 0,
    },
    { href: "/admin/vehicles", 
      title: "Vehicle verification", 
      sub: "Review vehicle documents and approve cars",
      label: "Vehicles", 
      n: inbox?.cars_pending ?? 0 },
    {
      href: "/admin/users",
      title: "User management",
      sub: "Search and manage platform users",
      n: 0,
    },
    {
      href: "/admin/bookings",
      title: "Bookings",
      sub: "View and monitor all bookings",
      n: 0,
    },
    {
      href: "/admin/payouts",
      title: "Driver payouts",
      sub: "Review outstanding driver payments",
      n: inbox?.owed_drivers ?? 0,
    },
    {
      href: "/admin/refunds",
      title: "Customer refunds",
      sub: "Review and process refunds",
      n: inbox?.refunds_count ?? 0,
    },
    {
      href: "/admin/reports",
      title: "Reports",
      sub: "Review customer and safety reports",
      n: inbox?.reports_open ?? 0,
    },
    {
      href: "/admin/stats",
      title: "Platform overview",
      sub: "View revenue and platform performance",
      n: 0,
    },
    {
      href: "/admin/notifications",
      title: "Notifications",
      sub: "View alerts and recent platform activity",
      n: inbox ? inboxTotal(inbox) : 0,
    },
    {href:"/profile", 
    title:"Profile", 
    sub:"View and edit your admin profile",
     n:0},
    { href: "/admin/team",
       label: "Team", 
       n: 0 },
  ];

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      {/* FIXED TOP-LEFT MENU BUTTON */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin navigation"
        aria-expanded={open}
        className="fixed left-4 top-4 z-30 flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white shadow-md transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      >
        <span className="block h-0.5 w-5 rounded-full bg-indigo-700" />
        <span className="block h-0.5 w-5 rounded-full bg-indigo-700" />
        <span className="block h-0.5 w-5 rounded-full bg-indigo-700" />
      </button>

      {/* BACKGROUND OVERLAY */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/40 transition-opacity duration-300 ${
          open
            ? "visible opacity-100"
            : "invisible opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* SLIDE-OUT ADMIN SIDEBAR */}
      <aside
        aria-label="Admin navigation"
        aria-hidden={!open}
        className={`fixed left-0 top-0 z-50 flex h-dvh w-[310px] max-w-[88vw] flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 text-gray-900 shadow-2xl transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* SIDEBAR HEADER */}
        <div className="border-b border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                Key and Go
              </p>

              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Administration
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Manage your platform operations.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close admin navigation"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Close
            </button>
          </div>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 space-y-2 p-3">
          <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Management
          </p>

          {tools.map((tool, index) => {
            const active =
              pathname === tool.href ||
              pathname.startsWith(`${tool.href}/`);

            return (
              <Link
                key={tool.href}
                href={tool.href}
                onClick={() => setOpen(false)}
                tabIndex={open ? 0 : -1}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center justify-between gap-3 rounded-xl border p-3 transition-all duration-200 hover:translate-x-0.5 hover:shadow-sm ${
                  active
                    ? "border-indigo-200 bg-indigo-50 text-indigo-800 shadow-sm"
                    : "border-transparent bg-white text-gray-800 hover:border-gray-200 hover:bg-gray-50"
                }`}
                style={{
                  transitionDelay: open ? `${index * 25}ms` : "0ms",
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {tool.title}
                  </span>

                  <span
                    className={`mt-1 block text-xs leading-relaxed ${
                      active ? "text-indigo-600" : "text-gray-500"
                    }`}
                  >
                    {tool.sub}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  {tool.n > 0 && <Badge n={tool.n} />}

                  <span
                    className={`text-lg transition-transform duration-200 group-hover:translate-x-0.5 ${
                      active ? "text-indigo-600" : "text-gray-400"
                    }`}
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        {/* SIDEBAR FOOTER */}
        <div className="border-t border-gray-200 bg-white p-3">
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            tabIndex={open ? 0 : -1}
            className="flex items-center justify-between rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <span>Admin home</span>
            <span aria-hidden="true">›</span>
          </Link>

          <p className="px-3 pb-1 pt-3 text-center text-[10px] text-gray-400">
            Key and Go Administration
          </p>
        </div>
      </aside>
    </>
  );
}
