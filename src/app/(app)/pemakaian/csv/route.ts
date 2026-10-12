import { createClient } from "@/lib/supabase/server";
import { listSessions, loadItems, loadLines } from "@/lib/data";
import { calcLine, formatQty } from "@/lib/qty";

// Same columns as the old spreadsheet, so a day's count can still be opened in Excel.
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  const supabase = await createClient();
  const session = (await listSessions(supabase)).find((s) => s.count_date === date);
  if (!session) return new Response("Not found", { status: 404 });
  const [items, lines] = await Promise.all([loadItems(supabase), loadLines(supabase, session.id)]);

  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [["NO", "NAMA BAHAN", "KATEGORI", "SATUAN", "AWAL", "MASUK", "KELUAR", "TERSEDIA"]];
  items.forEach((item, n) => {
    const l = lines.get(item.id);
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
