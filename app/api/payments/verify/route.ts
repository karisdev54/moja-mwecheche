import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stkQuery } from "@/lib/daraja";
import { markPaymentFailed, markPaymentSuccess } from "@/lib/payments";

function friendly(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes("cancel")) return "You cancelled the payment. Tap Pay to try again.";
  if (d.includes("insufficient")) return "Insufficient M-Pesa balance. Top up and try again.";
  if (d.includes("pin") || d.includes("wrong")) return "Wrong M-Pesa PIN. Tap Pay to try again.";
  if (d.includes("timeout") || d.includes("timed out") || d.includes("dnd")) {
    return "The prompt timed out. Tap Pay to try again.";
  }
  return "Payment did not go through. Tap Pay to try again.";
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const { data: u } = await supabaseAdmin.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  let body: { bookingId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id,booking_id,amount,status,checkout_request_id,customer_id,result_desc")
    .eq("booking_id", body.bookingId ?? "")
    .eq("customer_id", u.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment) return NextResponse.json({ state: "none" });

  if (payment.status === "success") return NextResponse.json({ state: "success" });
  if (payment.status === "failed") {
    return NextResponse.json({ state: "failed", message: friendly(payment.result_desc ?? "") });
  }

  try {
    const result = await stkQuery(payment.checkout_request_id);

    if (result.state === "success") {
      await markPaymentSuccess(payment, null, result.description);
      return NextResponse.json({ state: "success" });
    }
    if (result.state === "failed") {
      await markPaymentFailed(payment.id, result.description);
      return NextResponse.json({ state: "failed", message: friendly(result.description) });
    }
    return NextResponse.json({ state: "pending" });
  } catch (e) {
    console.error("Verify error", e);
    return NextResponse.json({ state: "pending" });
  }
}