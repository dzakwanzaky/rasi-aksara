import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sortItems, type Item, type LineRow, type Session } from "@/lib/types";
import { CountSheet } from "./CountSheet";

export default async function OpnamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: session }, { data: items }, { data: lines }] = await Promise.all([
    supabase.from("opname_sessions").select("id, count_date, note, created_at").eq("id", id).maybeSingle(),
    supabase.from("items").select("*").eq("active", true),
    supabase.from("opname_lines").select("session_id, item_id, awal, masuk, tersedia").eq("session_id", id),
  ]);
  if (!session) notFound();
  return (
    <CountSheet
      session={session as Session}
      items={sortItems((items ?? []) as Item[])}
      initialLines={(lines ?? []) as LineRow[]}
    />
  );
}
