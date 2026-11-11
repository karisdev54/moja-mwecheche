import { supabaseAdmin } from "@/lib/supabaseAdmin";

// True if this action is allowed. If the check itself fails we allow it, so a database hiccup never blocks a real payment.
export async function allow(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("hit_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed:", error.message);
    return true;
  }
  return data === true;
}