import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listSessions, loadItems, loadLines } from "@/lib/data";
import { formatQty } from "@/lib/qty";
import { restockNeeds, restockText } from "@/lib/restock";
import { CATEGORIES, dateLabel } from "@/lib/types";
import { CopyList } from "./CopyList";

export default async function Belanja() {
  const supabase = await createClient();
  const [sessions, items] = await Promise.all([listSessions(supabase), loadItems(supabase)]);
  const latest = sessions[0];
  if (!latest) return <p className="empty">Daftar belanja muncul setelah ada hitungan stok pertama.</p>;

  const lines = await loadLines(supabase, latest.id);
  const { needs, counted } = restockNeeds(items, lines);
  const withMin = items.filter((i) => i.min_stock && i.min_stock > 0).length;

  const text = restockText(needs, latest.count_date);

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
