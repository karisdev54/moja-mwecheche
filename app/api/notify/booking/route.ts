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
};
type Hook = {
  type: "INSERT" | "UPDATE" | "DELETE";
  record: Row | null;
  old_record: Row | null;
};
type Person = { id: string; full_name: string | null; phone: string | null };

export async function POST(req: Request) {
  if (!process.env.WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hook = (await req.json()) as Hook;
  if (hook.type !== "UPDATE" || !hook.record || !hook.old_record) {
    return NextResponse.json({ ok: true });
  }
  const n = hook.record;
  const o = hook.old_record;

  const ids = [n.customer_id, n.driver_id].filter((x): x is string => !!x);
  const { data } = await supabaseAdmin.from("profiles").select("id,full_name,phone").in("id", ids);
  const people = new Map<string, Person>(((data ?? []) as Person[]).map((p) => [p.id, p]));
  const customer = people.get(n.customer_id);
  const driver = n.driver_id ? people.get(n.driver_id) : undefined;

  const when = new Date(n.scheduled_at).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const jobs: Promise<void>[] = [];

  if (o.status === "requested" && n.status === "accepted") {
    jobs.push(
      sendSms(
        customer?.phone,
        `Your ${n.task_type} booking for ${when} was accepted by ${driver?.full_name ?? "a driver"} (${driver?.phone ?? ""}). Open the app to pay KES ${n.price}.`
      )
    );
  }

  if (!o.paid && n.paid) {
    jobs.push(sendSms(customer?.phone, `Payment of KES ${n.price} received. Your driver is confirmed for ${when}.`));
    jobs.push(sendSms(driver?.phone, `Booking paid: ${n.task_type} on ${when}. You can start the job.`));
  }

  if (o.status !== "completed" && n.status === "completed") {
    jobs.push(sendSms(customer?.phone, `Your ${n.task_type} job is complete. Thank you for using our service!`));
  }

  if (o.status !== "cancelled" && n.status === "cancelled" && n.driver_id) {
    jobs.push(sendSms(driver?.phone, `The ${n.task_type} booking for ${when} was cancelled by the customer.`));
  }

  await Promise.all(jobs);
  return NextResponse.json({ ok: true });
}