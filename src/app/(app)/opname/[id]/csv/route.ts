import { createClient } from "@/lib/supabase/server";
import { calcLine, formatQty } from "@/lib/qty";
import { sortItems, type Item, type LineRow } from "@/lib/types";

// Same columns as the old spreadsheet, so it can still be opened in Excel.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: session }, { data: items }, { data: lines }] = await Promise.all([
    supabase.from("opname_sessions").select("count_date").eq("id", id).maybeSingle(),
    supabase.from("items").select("*").eq("active", true),
    supabase.from("opname_lines").select("item_id, awal, masuk, tersedia").eq("session_id", id),
  ]);
  if (!session) return new Response("Not found", { status: 404 });

  const byItem = new Map((lines ?? []).map((l) => [l.item_id, l as LineRow]));
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [["NO", "NAMA BAHAN", "KATEGORI", "SATUAN", "AWAL", "MASUK", "KELUAR", "TERSEDIA"]];
  sortItems((items ?? []) as Item[]).forEach((item, n) => {
    const l = byItem.get(item.id);
    const r = calcLine(l, item);
    rows.push([String(n + 1), item.name, item.category, item.unit, l?.awal ?? "", l?.masuk ?? "", r.keluar == null ? "" : formatQty(r.keluar), l?.tersedia ?? ""]);
  });
  const csv = `tgl,${session.count_date}\n` + rows.map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stok-opname-${session.count_date}.csv"`,
    },
  });
}
