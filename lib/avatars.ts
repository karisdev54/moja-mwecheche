import { supabase } from "@/lib/supabase";

// Returns { personId: pictureUrl } for everyone who has a picture
export async function fetchAvatars(ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (list.length === 0) return {};
  const { data } = await supabase.from("profiles").select("id,avatar_url").in("id", list);
  const out: Record<string, string> = {};
  ((data ?? []) as { id: string; avatar_url: string | null }[]).forEach((r) => {
    if (r.avatar_url) out[r.id] = r.avatar_url;
  });
  return out;
}