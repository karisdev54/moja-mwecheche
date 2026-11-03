import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendSms } from "@/lib/sms";

type Row = {
  id: string;
  customer_id: string;
  driver_id: string | null;
  status: string;
  paid: boolean;
  task_type: string;
  scheduled_at: string;
  price: number;
  pickup_lat: number;
  pickup_lng: number;
  widened_at: string | null;
  refund_status: string;
  driver_earnings: number | null;
  vehicle: string;
  timing: string;
};
type Hook = {
  type: "INSERT" | "UPDATE" | "DELETE";
  record: Row | null;
  old_record: Row | null;
};
type Person = { id: string; full_name: string | null; phone: string | null; car_plate: string | null };

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "medium",
    timeStyle: "short",
  });

const plateText = (p: string | null | undefined) => {
  if (!p) return "";
  const m = p.match(/^([A-Z]{3,4})(\d{3})([A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}${m[3]}` : p;
};

export async function POST(req: Request) {
  const expected = (process.env.WEBHOOK_SECRET ?? "").trim();
  const sent = (req.headers.get("x-webhook-secret") ?? "").trim();

  if (!expected) {
    console.error("notify/booking: WEBHOOK_SECRET is not set in this deployment");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (sent !== expected) {
    // Lengths only, so the secret itself never reaches the logs
    console.error(
      `notify/booking: secret mismatch (sent ${sent ? sent.length + " chars" : "nothing"}, expected ${expected.length} chars)`
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hook = (await req.json()) as Hook;

  // New request: text the nearest online drivers
    // New request: text the right drivers
  if (hook.type === "INSERT" && hook.record) {
    const r = hook.record;
    if (r.status !== "requested") return NextResponse.json({ ok: true });

    const later = r.timing === "later";
    const { data } = later
      ? await supabaseAdmin.rpc("verified_driver_phones_near", {
          p_lat: r.pickup_lat,
          p_lng: r.pickup_lng,
          p_vehicle: r.vehicle,
        })
      : await supabaseAdmin.rpc("online_driver_phones_near", {
          p_lat: r.pickup_lat,
          p_lng: r.pickup_lng,
        });
    const drivers = (data ?? []) as { driver_id: string; phone: string }[];
    const when = formatWhen(r.scheduled_at);

    await Promise.all(
      drivers.map((d) =>
        sendSms(
          d.phone,
          later
            ? `New booking for ${when}: ${r.task_type}, KES ${r.price}. Open the app, Later tab, to accept: ${process.env.APP_BASE_URL}`
            : `New ${r.task_type} request near you right now, KES ${r.price}. Open the app to accept: ${process.env.APP_BASE_URL}`
        )
      )
    );
    return NextResponse.json({ ok: true, notified: drivers.length });
  }

  if (hook.type !== "UPDATE" || !hook.record || !hook.old_record) {
    return NextResponse.json({ ok: true });
  }
  const n = hook.record;
  const o = hook.old_record;

  const ids = [n.customer_id, n.driver_id].filter((x): x is string => !!x);
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id,full_name,phone,car_plate")
    .in("id", ids);
  const people = new Map<string, Person>(((data ?? []) as Person[]).map((p) => [p.id, p]));
  const customer = people.get(n.customer_id);
  const driver = n.driver_id ? people.get(n.driver_id) : undefined;
  const when = formatWhen(n.scheduled_at);

  const jobs: Promise<void>[] = [];

  if (o.status === "requested" && n.status === "accepted") {
    const car =
      n.vehicle === "driver_car" && driver?.car_plate ? ` Car: ${plateText(driver.car_plate)}.` : "";
    jobs.push(
      sendSms(
        customer?.phone,
        `Your ${n.task_type} booking for ${when} was accepted by ${driver?.full_name ?? "a driver"} (${driver?.phone ?? ""}).${car} Open the app to pay KES ${n.price}.`
      )
    );
  }

  if (!o.paid && n.paid) {
    jobs.push(sendSms(customer?.phone, `Payment of KES ${n.price} received. Your driver is confirmed for ${when}.`));
    jobs.push(sendSms(driver?.phone, `Booking paid: ${n.task_type} on ${when}. You can start the job.`));
  }

  if (o.status !== "completed" && n.status === "completed") {
    jobs.push(
      sendSms(
        customer?.phone,
        `Thank you for choosing KEY AND GO! Your ${n.task_type} job is complete. Please rate your driver in the app.`
      )
    );
    jobs.push(
      sendSms(
        driver?.phone,
        `Well done! Your ${n.task_type} job is complete. You earned KES ${Math.round(Number(n.driver_earnings ?? 0))}. Thank you for driving with KEY AND GO.`
      )
    );
  }

  if (o.status !== "cancelled" && n.status === "cancelled" && n.driver_id) {
    jobs.push(sendSms(driver?.phone, `The ${n.task_type} booking for ${when} was cancelled by the customer.`));
  }

  // Request widened to 25 km: tell the customer and text drivers in the new ring
  if (!o.widened_at && n.widened_at && n.status === "requested") {
    jobs.push(
      sendSms(customer?.phone, `Still looking for a driver for your ${n.task_type} booking. We widened the search to 25 km.`)
    );
    const { data: ring } = await supabaseAdmin.rpc("online_driver_phones_ring", {
      p_lat: n.pickup_lat,
      p_lng: n.pickup_lng,
      p_from_km: 10,
      p_to_km: 25,
    });
    for (const d of (ring ?? []) as { driver_id: string; phone: string }[]) {
      jobs.push(
        sendSms(
          d.phone,
          `New ${n.task_type} request for ${when}, KES ${n.price}. Open the app to accept: ${process.env.APP_BASE_URL}`
        )
      );
    }
  }

  // Nobody accepted in time
  if (o.status === "requested" && n.status === "expired") {
    jobs.push(
      sendSms(customer?.phone, `Sorry, no driver accepted your ${n.task_type} request. Open the app to request again.`)
    );
  }

  // Refunds
  if (o.refund_status !== "needed" && n.refund_status === "needed") {
    jobs.push(
      sendSms(customer?.phone, `Your booking was cancelled. We received your refund request and will send it to your M-Pesa.`)
    );
  }
  if (o.refund_status !== "refunded" && n.refund_status === "refunded") {
    jobs.push(sendSms(customer?.phone, `Your refund has been sent to your M-Pesa. Thank you for your patience.`));
  }

  await Promise.all(jobs);
  return NextResponse.json({ ok: true });
}