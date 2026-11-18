"use client";
import { useEffect, useRef } from "react";
import { inboxTotal, useInbox, type Inbox } from "@/lib/inbox";
import { toast } from "@/lib/toast";

const n = (v: number | undefined) => v ?? 0;

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
        toast(`${total} thing${total === 1 ? "" : "s"} waiting for you`, { href: "/admin/notifications", tone: "warn" });
      }
      return;
    }

    if (n(inbox.reports_safety) > n(p.reports_safety)) {
      toast("New safety report", { href: "/admin/reports", tone: "danger" });
    } else if (n(inbox.reports_open) > n(p.reports_open)) {
      toast("New report", { href: "/admin/reports" });
    }
    if (n(inbox.drivers_pending) > n(p.drivers_pending)) {
      toast("A driver is waiting for verification", { href: "/admin/verification" });
    }
    if (n(inbox.cars_pending) > n(p.cars_pending)) {
      toast("A vehicle is waiting for approval", { href: "/admin/vehicles" });
    }
    if (n(inbox.refunds_count) > n(p.refunds_count)) {
      toast("A refund needs sending", { href: "/admin/refunds" });
    }
    if (n(inbox.payout_requests) > n(p.payout_requests)) {
      toast("A driver requested a payout", { href: "/admin/payouts" });
    }
    if (n(inbox.recon_issues) > n(p.recon_issues)) {
      toast("The money check found something to look at", { href: "/admin/reconcile", tone: "warn" });
    }
  }, [inbox]);

  return null;
}