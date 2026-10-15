import type { SupabaseClient } from "@supabase/supabase-js";

/** Whether the signed-in account may change items and staff (a row in app_admins, migration 0008). */
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase.from("app_admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
  return Boolean(data);
}
