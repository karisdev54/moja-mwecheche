import { supabase } from "@/lib/supabase";
import { confirmDialog } from "@/lib/dialog";

// Asks first, switches a driver offline (which stops location sharing), then shows the goodbye page.
// By default the person stays signed in, so opening the app again is instant.
// Returns false if the person chose to stay.
export async function exitApp(opts: { signOut?: boolean } = {}): Promise<boolean> {
  const signOut = opts.signOut ?? false;
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  let isDriver = false;

  if (uid) {
    const { data: d } = await supabase.from("drivers").select("is_available").eq("id", uid).maybeSingle();
    isDriver = !!d;

    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", uid)
      .in("status", ["accepted", "in_progress"]);
    const onJob = (count ?? 0) > 0;

    const ok = await confirmDialog(
      onJob
        ? {
            title: "You have a job in progress",
            message: "If you exit now, you go offline and your customer stops seeing you on the map. You can open the app again at any time.",
            confirmText: "Exit anyway",
            cancelText: "Stay in app",
            danger: true,
          }
        : isDriver
          ? {
              title: "Exit the app?",
              message: "You will go offline and stop sharing your location. You stay signed in, so you can open the app again at any time.",
              confirmText: "Exit",
              cancelText: "Stay in app",
            }
          : {
              title: "Exit the app?",
              message: "You stay signed in, so opening the app again takes you straight back in.",
              confirmText: "Exit",
              cancelText: "Stay in app",
            }
    );
    if (!ok) return false;

    if (isDriver) await supabase.from("drivers").update({ is_available: false }).eq("id", uid);
  }

  if (signOut) await supabase.auth.signOut();
  window.location.replace(`/goodbye?out=${signOut ? 1 : 0}&d=${isDriver ? 1 : 0}`);
  return true;
}