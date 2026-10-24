import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const COMMISSION_RATE = 0.15; // your cut: 15%

type PaymentRef = { id: string; booking_id: string; amount: number | string };

// Returns true only for the call that actually completes the payment
export async function markPaymentSuccess(
  payment: PaymentRef,
  receipt: string | null,
  description: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .update({ status: "success", mpesa_receipt: receipt, result_desc: description })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");

  if (error || !data || data.length === 0) return false; // already handled

  const total = Number(payment.amount);
  const commission = Math.round(total * COMMISSION_RATE * 100) / 100;

  await supabaseAdmin
    .from("bookings")
    .update({
      paid: true,
      paid_at: new Date().toISOString(),
      commission,
      driver_earnings: total - commission,
    })
    .eq("id", payment.booking_id)
    .eq("paid", false);

      // If the booking was cancelled while the prompt was open, flag the money for refund
  const { data: b } = await supabaseAdmin
    .from("bookings")
    .select("status")
    .eq("id", payment.booking_id)
    .maybeSingle();
    
  if (b?.status === "cancelled") {
    await supabaseAdmin
      .from("bookings")
      .update({ refund_status: "needed", refund_amount: total })
      .eq("id", payment.booking_id)
      .eq("refund_status", "none");
  }
  return true;
}

export async function markPaymentFailed(paymentId: string, description: string): Promise<void> {
  await supabaseAdmin
    .from("payments")
    .update({ status: "failed", result_desc: description })
    .eq("id", paymentId)
    .eq("status", "pending");
}