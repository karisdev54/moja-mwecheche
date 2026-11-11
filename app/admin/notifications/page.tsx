
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Loader from "@/components/Loader";
import type { Inbox } from "@/lib/inbox";
import BottomNav from "@/components/BottomNav";
import AdminNav from "@/components/AdminNav";
import { PageHeader } from "@/components/AdminUI";

type Ev = {
  ts: string;
  kind: string;
  direction: "in" | "out" | "info";
  title: string;
  detail: string;
  amount: number | null;
};

type State = {
  inbox: Inbox | null;
  feed: Ev[];
  at: number;
};

type TodoItem = {
  title: string;
  detail: string;
  href?: string;
  tone: "red" | "amber" | "indigo";
};

const kes = (n: number) =>
  `KES ${Math.round(Number(n)).toLocaleString()}`;

function ago(iso: string, now: number) {
  const seconds = Math.max(
    1,
    Math.round((now - new Date(iso).getTime()) / 1000)
  );

  if (seconds < 60) return "Just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;

  return new Date(iso).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function load(): Promise<State> {
  const { data: inbox } = await supabase.rpc("admin_inbox");
  const { data: feed } = await supabase.rpc("admin_feed", {
    p_limit: 40,
  });

  return {
    inbox: (inbox as Inbox | null) ?? null,
    feed: (feed ?? []) as Ev[],
    at: Date.now(),
  };
}

export default function NotificationsPage() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let active = true;

    const run = () => {
      load().then((result) => {
        if (active) setState(result);
      });
    };

    run();

    const timer = setInterval(run, 30000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!state) return <Loader full />;

  if (!state.inbox) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 text-gray-900">
        <p className="max-w-2xl mx-auto">
          Not authorized.{" "}
          <Link href="/login" className="font-semibold text-indigo-600 underline">
            Log in as admin
          </Link>
        </p>
      </main>
    );
  }

  const inbox = state.inbox;

  const todo: TodoItem[] = [];

  if (inbox.reports_safety > 0) {
    todo.push({
      title: "Safety reports require attention",
      detail: `${inbox.reports_safety} safety report${
        inbox.reports_safety > 1 ? "s are" : " is"
      } awaiting administrator review.`,
      href: "/admin/reports",
      tone: "red",
    });
  }

  if (inbox.drivers_pending > 0) {
    todo.push({
      title: "Driver verification pending",
      detail: `${inbox.drivers_pending} driver${
        inbox.drivers_pending > 1 ? "s are" : " is"
      } waiting for document verification.`,
      href: "/admin",
      tone: "amber",
    });
  }

  if (inbox.owed_drivers > 0) {
    todo.push({
      title: "Driver payouts outstanding",
      detail: `${kes(inbox.owed_total)} is owed to ${
        inbox.owed_drivers
      } driver${inbox.owed_drivers > 1 ? "s" : ""}.`,
      href: "/admin/payouts",
      tone: "amber",
    });
  }

  if (inbox.refunds_count > 0) {
    todo.push({
      title: "Customer refunds awaiting payment",
      detail: `${inbox.refunds_count} refund${
        inbox.refunds_count > 1 ? "s" : ""
      } totalling ${kes(inbox.refunds_amount)} need to be processed.`,
      href: "/admin/refunds",
      tone: "amber",
    });
  }

  const plainReports = inbox.reports_open - inbox.reports_safety;

  if (plainReports > 0) {
    todo.push({
      title: "Open customer reports",
      detail: `${plainReports} report${
        plainReports > 1 ? "s are" : " is"
      } waiting for review.`,
      href: "/admin/reports",
      tone: "indigo",
    });
  }

  if (inbox.stuck_payments > 0) {
    todo.push({
      title: "Payments need investigation",
      detail: `${inbox.stuck_payments} payment${
        inbox.stuck_payments > 1 ? "s have" : " has"
      } remained pending for more than 15 minutes. Check the payments table.`,
      tone: "indigo",
    });
  }

  const feed = state.feed;

  const toneStyles = {
    red: "border-red-200 border-l-red-500 bg-red-50",
    amber: "border-amber-200 border-l-amber-500 bg-amber-50",
    indigo: "border-indigo-200 border-l-indigo-500 bg-indigo-50",
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-28">
      <div className="max-w-2xl mx-auto space-y-5 text-gray-900">

        {/* PAGE HEADER */}
        <div className="slide-in">
          <PageHeader
            title="Notifications"
            subtitle="Platform updates, outstanding tasks and recent activity."
          />
        </div>

        
          <AdminNav />
        

        {/* SUMMARY */}
        <section
          className="grid grid-cols-3 gap-2 slide-in"
          style={{ animationDelay: "100ms" }}
        >
          <div className="bg-white rounded-2xl shadow p-3">
            <p className="text-2xl font-extrabold tracking-tight text-gray-900">
              {todo.length}
            </p>
            <p className="text-xs font-medium text-gray-500 mt-1">
              Pending actions
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-3">
            <p className="text-2xl font-extrabold tracking-tight text-gray-900">
              {feed.length}
            </p>
            <p className="text-xs font-medium text-gray-500 mt-1">
              Activity records
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-3">
            <p className="text-2xl font-extrabold tracking-tight text-indigo-600">
              30s
            </p>
            <p className="text-xs font-medium text-gray-500 mt-1">
              Refresh interval
            </p>
          </div>
        </section>

        {/* ACTION CENTRE */}
        <section className="bg-white rounded-2xl shadow p-4 space-y-3 slide-in"
          style={{ animationDelay: "150ms" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Administrator overview
              </p>
              <h2 className="text-lg font-extrabold mt-1">
                Action centre
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Review the tasks that need your attention.
              </p>
            </div>

            <span className="shrink-0 rounded-xl bg-indigo-50 text-indigo-700 px-3 py-2 text-center">
              <span className="block text-xl font-extrabold">
                {todo.length}
              </span>
              <span className="block text-[10px] font-bold uppercase">
                Pending
              </span>
            </span>
          </div>

          <div className="border-t border-gray-100" />

          {todo.length === 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
              <p className="font-extrabold text-green-800">
                Everything is up to date
              </p>
              <p className="text-sm text-green-700 mt-1">
                There are no outstanding administrator tasks at the moment.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {todo.map((item, index) => {
                const content = (
                  <div
                    className={`rounded-xl border border-l-4 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${toneStyles[item.tone]}`}
                    style={{
                      animationDelay: `${index * 60}ms`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-gray-900">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-600 leading-relaxed mt-1">
                          {item.detail}
                        </p>

                        {item.href && (
                          <p className="text-xs font-bold text-indigo-700 mt-2">
                            Review this task
                          </p>
                        )}

                        {!item.href && (
                          <p className="text-xs font-semibold text-gray-500 mt-2">
                            Administrator action required
                          </p>
                        )}
                      </div>

                      {item.href && (
                        <span className="text-xs font-bold text-indigo-700 shrink-0">
                          View
                        </span>
                      )}
                    </div>
                  </div>
                );

                return item.href ? (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="block slide-in"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={item.title} className="slide-in">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ACTIVITY FEED */}
        <section className="space-y-3">

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Recent updates
              </p>
              <h2 className="text-lg font-extrabold mt-1">
                Platform activity
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                A record of recent events across Key and Go.
              </p>
            </div>

            <span className="text-xs font-bold text-gray-500 whitespace-nowrap">
              {feed.length} records
            </span>
          </div>

          {feed.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-6 text-center">
              <h3 className="font-bold text-gray-800">
                No activity recorded yet
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                New platform events will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feed.map((event, index) => {
                const isMoneyEvent =
                  event.kind === "payment" ||
                  event.kind === "payout" ||
                  event.kind === "refund";

                return (
                  <article
                    key={`${event.ts}-${index}`}
                    className="slide-in bg-white rounded-2xl shadow p-4 space-y-3 transition-all duration-200 hover:shadow-md"
                    style={{
                      animationDelay: `${Math.min(index, 10) * 45}ms`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-gray-900">
                          {event.title}
                        </h3>

                        <p className="text-xs text-gray-600 leading-relaxed mt-1">
                          {event.detail}
                        </p>
                      </div>

                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 whitespace-nowrap">
                        {event.kind.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="flex items-end justify-between gap-3 border-t border-gray-100 pt-3">
                      <div className="space-y-1">
                        <p className="text-[11px] text-gray-500 font-medium">
                          {ago(event.ts, state.at)}
                        </p>

                        {event.direction !== "info" && (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              event.direction === "in"
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {event.direction === "in"
                              ? "Incoming"
                              : "Outgoing"}
                          </span>
                        )}
                      </div>

                      {event.amount !== null &&
                        Number(event.amount) > 0 && (
                          <p
                            className={`text-sm font-extrabold whitespace-nowrap ${
                              isMoneyEvent
                                ? event.direction === "in"
                                  ? "text-green-700"
                                  : "text-red-600"
                                : "text-gray-800"
                            }`}
                          >
                            {isMoneyEvent
                              ? event.direction === "in"
                                ? "+"
                                : "−"
                              : ""}
                            {kes(Number(event.amount))}
                          </p>
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* REFRESH INFORMATION */}
        <div className="bg-white rounded-2xl shadow p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-gray-800">
              Automatic updates enabled
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Notifications refresh every 30 seconds.
            </p>
          </div>

          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
        </div>

      </div>

      <BottomNav />
    </main>
  );
}
