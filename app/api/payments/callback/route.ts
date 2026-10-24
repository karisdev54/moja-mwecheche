import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { markPaymentFailed, markPaymentSuccess } from "@/lib/payments";

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
    .select("id,booking_id,amount,status,mpesa_receipt")
    .eq("checkout_request_id", cb.CheckoutRequestID)
    .maybeSingle();

  if (!payment) return accepted;

  const items = cb.CallbackMetadata?.Item ?? [];
  const get = (name: string) => items.find((i) => i.Name === name)?.Value;
  const receipt = String(get("MpesaReceiptNumber") ?? "");
  const paidAmount = Number(get("Amount") ?? 0);

  // The verify route may have confirmed first without a receipt. Add it now.
  if (payment.status === "success") {
    if (!payment.mpesa_receipt && receipt && cb.ResultCode === 0) {
      await supabaseAdmin.from("payments").update({ mpesa_receipt: receipt }).eq("id", payment.id);
    }
    return accepted;
  }
  if (payment.status !== "pending") return accepted;

  if (cb.ResultCode !== 0) {
    await markPaymentFailed(payment.id, cb.ResultDesc ?? "Failed");
    return accepted;
  }

  if (!receipt || paidAmount < Number(payment.amount)) {
    await markPaymentFailed(payment.id, "Amount or receipt mismatch, review manually");
    return accepted;
  }

  await markPaymentSuccess(payment, receipt, cb.ResultDesc ?? "Success");
  return accepted;
}