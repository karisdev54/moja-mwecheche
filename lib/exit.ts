import { supabase } from "@/lib/supabase";

// Signs out, switches a driver offline (which also stops GPS sharing), then shows the goodbye page.
// Returns false if the person changed their mind.
export async function exitApp(): Promise<boolean> {
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
      !window.confirm("You have a job in progress. Exit anyway? Your customer will stop seeing you on the map.")
    ) {
      return false;
    }
    await supabase.from("drivers").update({ is_available: false }).eq("id", uid);
  }

  await supabase.auth.signOut();
  window.location.replace("/goodbye");
  return true;
}