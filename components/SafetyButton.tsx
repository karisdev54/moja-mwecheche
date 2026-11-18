"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { Icon, Tile } from "@/components/AdminUI";
import { friendlyError } from "@/lib/net";
import { toast } from "@/lib/toast";

export default function SafetyButton({
  bookingId,
  task,
  destination,
  who,
  plate,
}: {
  bookingId: string;
  task: string;
  destination?: string | null;
  who?: string | null;
  plate?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const share = async () => {
    const text = `I am on a KEY AND GO trip (${task}${destination ? ` to ${destination}` : ""}).${who ? ` With: ${who}.` : ""}${plate ? ` Car: ${plate}.` : ""}`;
    try {
      if (navigator.share) await navigator.share({ title: "My trip", text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Trip details copied", { tone: "ok", ms: 2000 });
      }
    } catch {
      // the person closed the share sheet
    }
  };

  const send = async (where: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSending(false);
      return;
    }
    const { error } = await supabase.from("reports").insert({
      user_id: u.user.id,
      category: "safety",
      booking_id: bookingId,
      message: `SOS pressed during a trip. ${where}`,
    });
    setSending(false);
    if (error) {
      toast(friendlyError(error.message), { tone: "danger" });
      return;
    }
    setSent(true);
  };

  const alertUs = () => {
    if (sending) return;
    setSending(true);
    if (!navigator.geolocation) {
      void send("Location was not available.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => void send(`Location: https://www.google.com/maps?q=${p.coords.latitude},${p.coords.longitude}`),
      () => void send("Location was not available."),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 text-red-700 bg-white font-bold p-2.5 text-sm active:scale-[0.98]"
      >
        <Icon name="shield" className="w-4 h-4" />
        Safety
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-4 bg-black/55 page-fade" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Safety"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 pop-in"
            >
              <div className="h-1.5" style={{ background: "linear-gradient(90deg,#dc2626,#f97316)" }} />
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <Tile name="shield" color="#dc2626" size="w-11 h-11" />
                  <div>
                    <h2 className="text-lg font-extrabold leading-tight">Safety</h2>
                    <p className="text-sm text-gray-700 mt-1">If you are in danger, call for help first.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {["999", "112"].map((n) => (
                    <a key={n} href={`tel:${n}`} className="flex items-center justify-center gap-2 bg-red-600 text-white font-bold rounded-xl p-3.5 active:scale-95">
                      <Icon name="phone" className="w-4 h-4" />
                      Call {n}
                    </a>
                  ))}
                </div>

                <button onClick={share} className="w-full flex items-center justify-center gap-2 bg-white border-2 border-indigo-200 font-bold rounded-xl p-3 active:scale-[0.98]">
                  <Icon name="share" className="w-4 h-4" />
                  Share my trip details
                </button>

                {sent ? (
                  <p className="slide-in flex items-start gap-2 rounded-xl bg-green-50 text-green-800 text-sm font-semibold p-3">
                    <Icon name="check" className="w-4 h-4 mt-0.5" />
                    We have been alerted and can see your trip. If you are in danger, call 999 now.
                  </p>
                ) : (
                  <button
                    onClick={alertUs}
                    disabled={sending}
                    className="w-full flex items-center justify-center gap-2 bg-white border-2 border-red-300 text-red-700 font-bold rounded-xl p-3 disabled:opacity-60 active:scale-[0.98]"
                  >
                    {sending ? (
                      <span className="w-4 h-4 rounded-full border-2 border-red-200 border-t-red-600 animate-spin" />
                    ) : (
                      <Icon name="alert" className="w-4 h-4" />
                    )}
                    {sending ? "Sending..." : "Alert KEY AND GO"}
                  </button>
                )}

                <button onClick={() => setOpen(false)} className="w-full text-sm font-bold text-gray-700 p-2">
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}