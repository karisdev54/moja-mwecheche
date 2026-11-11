import { createClient } from "@supabase/supabase-js";
import { isNetworkError, notifyNetworkDown } from "@/lib/net";

const netFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (e) {
    if (isNetworkError(e)) notifyNetworkDown();
    throw e;
  }
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { global: { fetch: netFetch } }
);