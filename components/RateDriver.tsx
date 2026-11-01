"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RateDriver({
  bookingId,
  customerId,
  onDone,
  onSkip,
}: {
  bookingId: string;
  customerId: string;
  onDone: () => void;
  onSkip?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    setMsg("");
    if (rating === 0) return setMsg("Tap a star to rate your driver.");
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
      <p className="font-semibold">Rate your driver</p>
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
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {msg && <p className="text-red-600 text-sm">{msg}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 bg-indigo-600 text-white font-bold rounded-lg p-3 disabled:opacity-50"
        >
          {busy ? "Sending..." : "Submit"}
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            disabled={busy}
            className="flex-1 bg-white border-2 border-indigo-200 font-semibold rounded-lg p-3"
          >
            No thanks
          </button>
        )}
      </div>
    </div>
  );
}