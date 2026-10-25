import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { markPaymentFailed, markPaymentSuccess } from "@/lib/payments";

export async function POST(req: Request) {
  // Off unless you turn it on, and never when Daraja is in production
  if (process.env.TEST_PAYMENTS !== "true" || process.env.DARAJA_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: u } = await supabaseAdmin.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { bookingId?: string };

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

  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .insert({
      booking_id: booking.id,
      customer_id: u.user.id,
      phone: "TEST",
      amount: Math.round(Number(booking.price)),
      checkout_request_id: `TEST-${randomUUID()}`,
    })
    .select("id,booking_id,amount")
    .single();

  if (error || !payment) {
    console.error("Test payment insert failed", error);
    return NextResponse.json({ error: "Could not record the test payment." }, { status: 500 });
  }

  // Each receipt must be unique, so every test payment gets its own
  const receipt = `TEST${randomUUID().slice(0, 8).toUpperCase()}`;
  const done = await markPaymentSuccess(payment, receipt, "Test payment, no money moved");
  if (!done) {
    await markPaymentFailed(payment.id, "Test payment could not be completed");
    return NextResponse.json({ error: "The payment row could not be completed." }, { status: 500 });
  }

  const { data: check } = await supabaseAdmin
    .from("bookings")
    .select("paid")
    .eq("id", booking.id)
    .maybeSingle();
  if (!check?.paid) {
    return NextResponse.json(
      { error: "Payment saved but the booking was not marked paid. Check the Vercel logs." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}