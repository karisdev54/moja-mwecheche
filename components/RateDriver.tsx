"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RateDriver({
  bookingId,
  customerId,
  onDone,
}: {
  bookingId: string;
  customerId: string;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    if (rating === 0) {
      setMsg("Tap a star to rate your driver.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("reviews").insert({
      booking_id: bookingId,
      customer_id: customerId,
      rating,
      comment: comment.trim() || null,
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else onDone();
  };

  return (
    <div className="mt-2 space-y-2 bg-white rounded-lg border-2 border-indigo-200 p-3">
      <p className="font-semibold text-gray-900">Rate your driver</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={`text-3xl leading-none p-1 ${n <= rating ? "text-yellow-500" : "text-gray-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="w-full border rounded-lg p-2"
        rows={2}
        maxLength={500}
        placeholder="Optional comment (punctual, polite, safe driving...)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {msg && <p className="text-red-600 text-sm">{msg}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full bg-black text-white rounded-lg p-3 disabled:opacity-50"
      >
        {busy ? "Sending..." : "Submit rating"}
      </button>
    </div>
  );
}