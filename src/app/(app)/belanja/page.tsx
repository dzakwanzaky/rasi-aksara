import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listSessions, loadItems, loadLines } from "@/lib/data";
import { formatQty, parseQty } from "@/lib/qty";
import { CATEGORIES, dateLabel, type Item } from "@/lib/types";
import { CopyList } from "./CopyList";

type Need = { item: Item; sisa: number; reason: "habis" | "menipis" };

export default async function Belanja() {
  const supabase = await createClient();
  const [sessions, items] = await Promise.all([listSessions(supabase), loadItems(supabase)]);
  const latest = sessions[0];
  if (!latest) return <p className="empty">Daftar belanja muncul setelah ada hitungan stok pertama.</p>;

  const lines = await loadLines(supabase, latest.id);
  const needs: Need[] = [];
  let counted = 0;
  for (const item of items) {
    const sisa = parseQty(lines.get(item.id)?.tersedia, item);
    if (sisa == null || Number.isNaN(sisa)) continue;
    counted++;
    if (sisa <= 0) needs.push({ item, sisa: 0, reason: "habis" });
    else if (item.min_stock && sisa < item.min_stock) needs.push({ item, sisa, reason: "menipis" });
  }
  const withMin = items.filter((i) => i.min_stock && i.min_stock > 0).length;

  const text = [
    `Belanja Rasi Aksara (stok ${dateLabel(latest.count_date)})`,
    ...CATEGORIES.flatMap((c) => {
      const g = needs.filter((n) => n.item.category === c);
      return g.length
        ? ["", `*${c}*`, ...g.map((n) => `- ${n.item.name}: ${n.reason === "habis" ? "HABIS" : `sisa ${formatQty(n.sisa)} ${n.item.unit}`}${n.item.min_stock ? ` (min ${formatQty(n.item.min_stock)})` : ""}`)]
        : [];
    }),
  ].join("\n");

  return (
    <>
      <div className="bar">
        <div>
          <p className="eyebrow">Berdasarkan hitungan {dateLabel(latest.count_date)}</p>
          <h2 className="big">{needs.length ? `${needs.length} bahan perlu dibeli` : "Tidak ada yang perlu dibeli"}</h2>
        </div>
        <span className="spacer" />
        {needs.length > 0 && <CopyList text={text} />}
      </div>

      {withMin === 0 && (
        <p className="note">
          Sekarang daftar ini hanya berisi bahan yang <b>habis</b>. Atur <b>stok minimum</b> tiap bahan di{" "}
          <Link href="/bahan">Bahan</Link> supaya bahan yang hampir habis juga masuk daftar.
        </p>
      )}
      {counted < items.length && (
        <p className="muted small">{items.length - counted} bahan belum dihitung di hitungan ini, jadi belum dicek.</p>
      )}

      {CATEGORIES.map((c) => {
        const g = needs.filter((n) => n.item.category === c);
        if (!g.length) return null;
        return (
          <section className="group" key={c}>
            <h3>{c}</h3>
            <ul className="list">
              {g.map((n) => (
                <li key={n.item.id} className="list-row">
                  <div>
                    <b>{n.item.name}</b>
                    {n.item.min_stock ? <span className="muted small"> · minimum {formatQty(n.item.min_stock)} {n.item.unit}</span> : null}
                  </div>
                  <span className={`pill ${n.reason === "habis" ? "bad" : "warn"}`}>
                    {n.reason === "habis" ? "Habis" : `Sisa ${formatQty(n.sisa)} ${n.item.unit}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
