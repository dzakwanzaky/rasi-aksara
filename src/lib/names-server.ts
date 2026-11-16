import type { SupabaseClient } from "@supabase/supabase-js";
import { makeBook, type NameBook, type StaffProfile } from "@/lib/names";

/** Everyone's formal names. Empty (so usernames show) until migration 0019 has been run. */
export async function loadNames(supabase: SupabaseClient): Promise<NameBook> {
  const { data, error } = await supabase.from("staff_profiles").select("username, full_name, nickname");
  return error ? {} : makeBook((data ?? []) as StaffProfile[]);
}
