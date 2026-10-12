import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcLine, formatQty } from "@/lib/qty";
import { CATEGORIES, dateLabel, sortItems, type Item, type LineRow, type Session } from "@/lib/types";

export default async function Riwayat({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode = (await searchParams).mode === "tersedia" ? "tersedia" : "keluar";
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("opname_sessions").select("id, count_date, note, created_at")
    .order("count_date", { ascending: false }).limit(8);
  const sessions = ((s ?? []) as Session[]).reverse();
  const [{ data: itemRows }, { data: lineRows }] = await Promise.all([
    supabase.from("items").select("*").eq("active", true),
    sessions.length
      ? supabase.from("opname_lines").select("session_id, item_id, awal, masuk, tersedia").in("session_id", sessions.map((x) => x.id))
      : Promise.resolve({ data: [] as LineRow[] }),
  ]);
  const items = sortItems((itemRows ?? []) as Item[]);
  const lines = new Map(((lineRows ?? []) as LineRow[]).map((l) => [`${l.session_id}:${l.item_id}`, l]));

  if (!sessions.length) return <p className="empty">Riwayat muncul setelah opname pertama dibuat.</p>;

  return (
    <>
      <div className="bar">
        <h2>Riwayat per minggu</h2>
        <span className="spacer" />
        <Link className="chip" aria-pressed={mode === "keluar"} href="/riwayat">Keluar (pemakaian)</Link>
        <Link className="chip" aria-pressed={mode === "tersedia"} href="/riwayat?mode=tersedia">Tersedia</Link>
      </div>
      <p className="help">
        {mode === "keluar"
          ? "Keluar = Awal + Masuk − Tersedia: perkiraan pemakaian tiap bahan per periode opname."
          : "Hasil hitung fisik di tiap opname. Teks abu-abu belum bisa dibaca sebagai angka; perbaiki satuan atau ukuran kemasan di Bahan."}
      </p>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Bahan</th>
              {sessions.map((x) => <th key={x.id}><Link href={`/opname/${x.id}`}>{dateLabel(x.count_date)}</Link></th>)}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.flatMap((c) => {
              const group = items.filter((i) => i.category === c);
              if (!group.length) return [];
              return [
                <tr className="cat" key={c}><td colSpan={sessions.length + 1}>{c}</td></tr>,
                ...group.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name} <span className="sub">{i.unit}</span></td>
                    {sessions.map((x) => {
                      const l = lines.get(`${x.id}:${i.id}`);
                      const r = calcLine(l, i);
                      const v = mode === "keluar" ? r.keluar : r.tersedia;
                      return (
                        <td className="n" key={x.id}>
                          {v == null ? <span className="sub">—</span> : Number.isNaN(v) ? <span className="sub">{l?.tersedia}</span> : formatQty(v)}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
