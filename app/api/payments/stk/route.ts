import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stkPush } from "@/lib/daraja";
import { toMsisdn } from "@/lib/phone";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const { data: u } = await supabaseAdmin.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  let body: { bookingId?: string; phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const msisdn = toMsisdn(body.phone ?? "");
  if (!msisdn) {
    return NextResponse.json({ error: "Enter a valid Safaricom number, e.g. 0712345678." }, { status: 400 });
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id,customer_id,price,status,paid")
    .eq("id", body.bookingId ?? "")
    .maybeSingle();

  if (!booking || booking.customer_id !== u.user.id) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  if (booking.paid) return NextResponse.json({ error: "Already paid." }, { status: 409 });
  if (booking.status !== "accepted") {
    return NextResponse.json({ error: "You can pay once a driver accepts." }, { status: 409 });
  }

  // Stop double taps from sending two prompts
  const since = new Date(Date.now() - 90 * 1000).toISOString();
  const { data: pending } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("status", "pending")
    .gte("created_at", since)
    .limit(1);
  if (pending && pending.length > 0) {
    return NextResponse.json({ error: "A payment prompt was just sent. Check your phone." }, { status: 409 });
  }

  try {
    const amount = Math.round(Number(booking.price));
    const r = await stkPush({
      phone: msisdn,
      amount,
      reference: `DRV${booking.id.slice(0, 8)}`,
      description: "Driver hire",
      callbackUrl: `${process.env.APP_BASE_URL}/api/payments/callback?secret=${process.env.DARAJA_CALLBACK_SECRET}`,
    });

    await supabaseAdmin.from("payments").insert({
      booking_id: booking.id,
      customer_id: u.user.id,
      phone: msisdn,
      amount,
      checkout_request_id: r.CheckoutRequestID,
      merchant_request_id: r.MerchantRequestID,
    });

    return NextResponse.json({ ok: true, message: "Check your phone and enter your M-Pesa PIN." });
  } catch (e) {
    console.error("STK error", e);
    return NextResponse.json({ error: "Could not start the payment. Please try again." }, { status: 502 });
  }
}