import type { SupabaseClient } from "@supabase/supabase-js";
import { sortItems, type Item, type LineRow, type Session } from "./types";

/** Today's date in the cafe's timezone, as YYYY-MM-DD. */
export const todayJakarta = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

export async function loadItems(supabase: SupabaseClient) {
  const { data } = await supabase.from("items").select("*").eq("active", true);
  return sortItems((data ?? []) as Item[]);
}

export async function listSessions(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("opname_sessions")
    .select("id, count_date, note, created_at")
    .order("count_date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as Session[];
}

export async function loadLines(supabase: SupabaseClient, sessionId: string) {
  const { data } = await supabase
    .from("opname_lines")
    .select("session_id, item_id, awal, masuk, tersedia")
    .eq("session_id", sessionId);
  return new Map(((data ?? []) as LineRow[]).map((l) => [l.item_id, l]));
}

/** All lines of the given counts, fetched in pages (Supabase returns at most 1000 rows per request). */
export async function loadLinesFor(supabase: SupabaseClient, sessionIds: string[]) {
  const out: LineRow[] = [];
  if (!sessionIds.length) return out;
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("opname_lines")
      .select("session_id, item_id, awal, masuk, tersedia")
      .in("session_id", sessionIds)
      .order("session_id").order("item_id")
      .range(from, from + 999);
    out.push(...((data ?? []) as LineRow[]));
    if (!data || data.length < 1000) return out;
  }
}
