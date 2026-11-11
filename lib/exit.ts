import { supabase } from "@/lib/supabase";
import  { confirmDialog } from "@/lib/dialog";

// Switches a driver offline (which stops location sharing) and shows the goodbye page.
// By default the person stays signed in, so reopening the app is instant. Pass signOut: true to sign out too.
// Returns false if the person changed their mind.
export async function exitApp(opts: { signOut?: boolean } = {}): Promise<boolean> {
  const signOut = opts.signOut ?? false;
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;

  if (uid) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", uid)
      .in("status", ["accepted", "in_progress"]);
        if (
      (count ?? 0) > 0 &&
      !(await confirmDialog({
        title: "Exit while on a job?",
        message: "You have a job in progress. Your customer will stop seeing you on the map.",
        confirmText: "Exit anyway",
        cancelText: "Stay",
        danger: true,
      }))
    ) {
      return false;
    }
    await supabase.from("drivers").update({ is_available: false }).eq("id", uid);
  }

  if (signOut) await supabase.auth.signOut();
  window.location.replace(`/goodbye?out=${signOut ? 1 : 0}`);
  return true;
}