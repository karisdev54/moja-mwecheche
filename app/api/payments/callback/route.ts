import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const COMMISSION_RATE = 0.15; // your cut: 15%. Change as you like.

type CallbackBody = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: { Name: string; Value?: string | number }[] };
    };
  };
};

export async function POST(req: Request) {
  const accepted = NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

  const secret = new URL(req.url).searchParams.get("secret");
  if (!process.env.DARAJA_CALLBACK_SECRET || secret !== process.env.DARAJA_CALLBACK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: CallbackBody;
  try {
    payload = await req.json();
  } catch {
    return accepted;
  }

  const cb = payload.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return accepted;

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id,booking_id,amount,status")
    .eq("checkout_request_id", cb.CheckoutRequestID)
    .maybeSingle();

  // Unknown or already handled (Safaricom can send the same callback twice)
  if (!payment || payment.status !== "pending") return accepted;

  if (cb.ResultCode !== 0) {
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", result_desc: cb.ResultDesc ?? "Failed" })
      .eq("id", payment.id);
    return accepted;
  }

  const items = cb.CallbackMetadata?.Item ?? [];
  const get = (name: string) => items.find((i) => i.Name === name)?.Value;
  const receipt = String(get("MpesaReceiptNumber") ?? "");
  const paidAmount = Number(get("Amount") ?? 0);

  if (!receipt || paidAmount < Number(payment.amount)) {
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed", result_desc: "Amount or receipt mismatch, review manually" })
      .eq("id", payment.id);
    return accepted;
  }

  const { error: payErr } = await supabaseAdmin
    .from("payments")
    .update({ status: "success", mpesa_receipt: receipt, result_desc: cb.ResultDesc ?? "Success" })
    .eq("id", payment.id)
    .eq("status", "pending");
  if (payErr) {
    console.error("Payment update failed", payErr);
    return accepted;
  }

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

  return accepted;
}