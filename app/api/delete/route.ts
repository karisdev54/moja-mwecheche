import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { allow } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const { data: u } = await supabaseAdmin.auth.getUser(token);
  const user = u.user;
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { confirm?: string; password?: string };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  // Admin accounts can never be deleted
  const { data: p } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (p?.role === "admin") {
    return NextResponse.json({ error: "Admin accounts cannot be deleted." }, { status: 403 });
  }
  if (!(await allow(`delete:${user.id}`, 5, 3600))) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }
  // Accounts that have a password must prove they know it
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];
  if (providers.includes("email")) {
    if (!body.password) return NextResponse.json({ error: "Enter your password." }, { status: 400 });
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error } = await anon.auth.signInWithPassword({ email: user.email as string, password: body.password });
    if (error) return NextResponse.json({ error: "Your password is wrong." }, { status: 403 });
  }

  // Refuses with the reasons if money is still unsettled
  const { error: prep } = await supabaseAdmin.rpc("prepare_account_deletion", { p_user: user.id });
  if (prep) return NextResponse.json({ error: prep.message }, { status: 409 });

  // Remove the person's files
  for (const bucket of ["avatars", "driver-docs"]) {
    const { data: files } = await supabaseAdmin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (files && files.length > 0) {
      await supabaseAdmin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
    }
  }

  // Finally remove the login. Their profile, documents and car details go with it.
  const { error: del } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (del) {
    console.error("delete user failed", del.message);
    return NextResponse.json({ error: "Could not finish deleting. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}