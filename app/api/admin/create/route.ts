import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { allow } from "@/lib/ratelimit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: u } = await supabaseAdmin.auth.getUser(token);
  const me = u.user;
  if (!me) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  // Only an active admin may create another admin
  const { data: p } = await supabaseAdmin.from("profiles").select("role,suspended").eq("id", me.id).maybeSingle();
  if (p?.role !== "admin" || p.suspended) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  if (!(await allow(`create-admin:${me.id}`, 5, 3600))) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string; email?: string; password?: string };
  const name = (body.name ?? "").trim().replace(/\s+/g, " ");
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (name.length < 2) return NextResponse.json({ error: "Enter the person's name." }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (password.length < 10 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
    return NextResponse.json({ error: "The password needs at least 10 characters, with letters and numbers." }, { status: 400 });
  }
  if (password.toLowerCase().includes(email.split("@")[0]) && email.split("@")[0].length >= 3) {
    return NextResponse.json({ error: "The password must not contain the email name." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, role: "customer" },
  });
  if (error || !data.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return NextResponse.json(
      { error: taken ? "That email already has an account. To promote an existing user, use the SQL editor." : "Could not create the account." },
      { status: taken ? 409 : 400 }
    );
  }

  const { error: roleErr } = await supabaseAdmin.rpc("make_admin", { p_user: data.user.id, p_by: me.id });
  if (roleErr) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id); // do not leave a half-made account behind
    return NextResponse.json({ error: "Could not set the admin role. Nothing was created." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}