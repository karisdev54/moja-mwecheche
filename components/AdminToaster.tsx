"use client";
import { useEffect, useRef } from "react";
import { inboxTotal, useInbox, type Inbox } from "@/lib/inbox";
import { toast } from "@/lib/toast";

export default function AdminToaster() {
  const inbox = useInbox();
  const prev = useRef<Inbox | null>(null);

  useEffect(() => {
    if (!inbox) return;
    const p = prev.current;
    prev.current = inbox;

    // First look after opening the app: one summary
    if (!p) {
      const total = inboxTotal(inbox);
      if (total > 0) {
        toast(`🔔 ${total} thing${total === 1 ? "" : "s"} waiting for you`, { href: "/admin/notifications", tone: "warn" });
      }
      return;
    }

    if (inbox.reports_safety > p.reports_safety) toast("🚨 New safety report", { href: "/admin/reports", tone: "danger" });
    else if (inbox.reports_open > p.reports_open) toast("💬 New report", { href: "/admin/reports" });
    if (inbox.drivers_pending > p.drivers_pending) toast("🪪 A driver is waiting for verification", { href: "/admin/verification" });
    if (inbox.refunds_count > p.refunds_count) toast("↩️ A refund needs sending", { href: "/admin/refunds" });
    if (inbox.owed_drivers > p.owed_drivers) toast("💸 A driver is waiting for a payout", { href: "/admin/payouts" });
    if (inbox.stuck_payments > p.stuck_payments) toast("⚠️ A payment looks stuck", { href: "/admin/notifications", tone: "warn" });
  }, [inbox]);

  return null;
}