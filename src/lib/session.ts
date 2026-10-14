import type { SupabaseClient } from "@supabase/supabase-js";

async function previousCount(supabase: SupabaseClient, countDate: string) {
  const { data } = await supabase
    .from("opname_sessions").select("id, count_date")
    .lt("count_date", countDate)
    .order("count_date", { ascending: false }).order("created_at", { ascending: false })
    .limit(1).maybeSingle();
  return data as { id: string; count_date: string } | null;
}

/** The count for a date, created if needed, with each item's starting stock taken from the previous count's "sisa". */
export async function openCount(supabase: SupabaseClient, countDate: string, userId?: string) {
  const { data: existing } = await supabase
    .from("opname_sessions").select("id").eq("count_date", countDate).limit(1).maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("opname_sessions").insert({ count_date: countDate, created_by: userId }).select("id").single();
  if (error?.code === "23505") {
    // Someone else opened this date a moment ago: use theirs.
    const { data } = await supabase.from("opname_sessions").select("id").eq("count_date", countDate).limit(1).single();
    return data!.id as string;
  }
  if (error) throw new Error("Gagal membuat hitungan: " + error.message);
  await syncCarryOver(supabase, created.id, countDate, userId);
  return created.id as string;
}

/** Keeps "stok kemarin" equal to the previous count's "sisa", e.g. when last night's count was corrected
 * after this morning's page was opened. Only writes rows that differ. Returns the previous count's date. */
export async function syncCarryOver(supabase: SupabaseClient, sessionId: string, countDate: string, userId?: string) {
  const prev = await previousCount(supabase, countDate);
  if (!prev) return null;
  const [{ data: prevLines }, { data: curLines }] = await Promise.all([
    supabase.from("opname_lines").select("item_id, tersedia").eq("session_id", prev.id),
    supabase.from("opname_lines").select("item_id, awal").eq("session_id", sessionId),
  ]);
  const cur = new Map((curLines ?? []).map((l) => [l.item_id as number, (l.awal as string | null) ?? null]));
  const rows = (prevLines ?? [])
    .filter((l) => String(l.tersedia ?? "").trim() !== "" && cur.get(l.item_id) !== l.tersedia)
    .map((l) => ({ session_id: sessionId, item_id: l.item_id, awal: l.tersedia, updated_by: userId }));
  if (rows.length) await supabase.from("opname_lines").upsert(rows, { onConflict: "session_id,item_id" });
  return prev.count_date;
}
