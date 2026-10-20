import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { loadLines } from "@/lib/data";
import { rupiah } from "@/lib/laporan";
import { formatQty } from "@/lib/qty";
import { expectedUsage, verdict, type Menu, type RecipeLine } from "@/lib/sales";
import { CATEGORIES, dateLabel, sortItems, type Item } from "@/lib/types";
import { usageOf } from "@/lib/usage";
import { deleteSalesDay } from "../actions";

export const dynamic = "force-dynamic";

type SaleRow = { menu: string; shift: string; qty: number; guessed: number };
type State = "lebih" | "kurang" | "ok" | "nounit" | "nocount" | "notonlist";

const ORDER: State[] = ["lebih", "kurang", "nounit", "nocount", "notonlist", "ok"];

export default async function PenjualanTanggal({
  params: p, searchParams,
}: { params: Promise<{ date: string }>; searchParams: Promise<{ hapus?: string }> }) {
  const { date } = await p;
  const { hapus } = await searchParams;
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) notFound();

  const { data: day } = await supabase.from("sales_days").select("*").eq("sale_date", date).maybeSingle();
  if (!day) notFound();
  const [{ data: sales }, { data: menus }, { data: recipe }, { data: itemRows }, { data: session }, { data: older }, { data: newer }] = await Promise.all([
    supabase.from("sales_lines").select("menu, shift, qty, guessed").eq("sale_date", date),
    supabase.from("menus").select("id, name, price"),
    supabase.from("recipe_lines").select("menu_id, item_id, qty"),
    supabase.from("items").select("*"),
    supabase.from("opname_sessions").select("id").eq("count_date", date).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("sales_days").select("sale_date").lt("sale_date", date).order("sale_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("sales_days").select("sale_date").gt("sale_date", date).order("sale_date").limit(1).maybeSingle(),
  ]);
  const rows = (sales ?? []) as SaleRow[];
  const items = sortItems((itemRows ?? []) as Item[]);
  const lines = session ? await loadLines(supabase, session.id) : new Map();

  const perMenu = new Map<string, { s1: number; s2: number; total: number; guessed: number }>();
  for (const r of rows) {
    const m = perMenu.get(r.menu) ?? { s1: 0, s2: 0, total: 0, guessed: 0 };
    if (r.shift === "1") m.s1 += r.qty;
    if (r.shift === "2") m.s2 += r.qty;
    m.total += r.qty;
    m.guessed += r.guessed;
    perMenu.set(r.menu, m);
  }
  const sold = [...perMenu].sort((a, b) => b[1].total - a[1].total);
  const portions = sold.reduce((s, [, m]) => s + m.total, 0);
  const guessed = sold.reduce((s, [, m]) => s + m.guessed, 0);

  const { expected, noRecipe } = expectedUsage(
    sold.map(([menu, m]) => ({ menu, qty: m.total })),
    (menus ?? []) as Menu[],
    (recipe ?? []) as RecipeLine[],
    new Map(items.map((i) => [i.id, i])),
  );

  const compare = items.filter((i) => expected.has(i.id)).map((item) => {
    const e = expected.get(item.id)!;
    const u = usageOf(item, lines.get(item.id));
    let state: State;
    if (!item.active) state = "notonlist";
    else if (!e.readable) state = "nounit";
    else if (u.status === "notcounted" || u.status === "noprev" || u.status === "unreadable") state = "nocount";
    else state = verdict(e.amount, u.used);
    const gap = u.used - e.amount;
    return { item, e, used: u.used, state, gap, rel: e.amount ? Math.abs(gap) / e.amount : 0 };
  }).sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || b.rel - a.rel);

  const off = compare.filter((c) => c.state === "lebih" || c.state === "kurang");
  const nounit = compare.filter((c) => c.state === "nounit");
  // Big gram/ml amounts read better without decimals.
  const q = (n: number, unit: string) => `${formatQty(Math.abs(n) >= 100 ? Math.round(n) : n)} ${unit}`.trim();

  return (
    <>
      <Link className="back" href="/penjualan">← Semua penjualan</Link>
      <div className="daynav">
        {older ? <Link className="btn small" href={`/penjualan/${older.sale_date}`} aria-label="Hari sebelumnya">‹</Link> : <span />}
        <div>
          <p className="eyebrow">Penjualan vs stok opname</p>
          <h2 className="big">{dateLabel(date)}</h2>
        </div>
        {newer ? <Link className="btn small" href={`/penjualan/${newer.sale_date}`} aria-label="Hari berikutnya">›</Link> : <span />}
      </div>

      <div className="tiles">
        <div className="tile"><span className="tile-n">{day.trx_count}</span><span className="tile-l">transaksi · {rupiah(day.total)}</span></div>
        <div className="tile"><span className="tile-n">{portions}</span><span className="tile-l">porsi terjual</span></div>
        <div className={`tile${off.length ? " warn" : ""}`}><span className="tile-n">{off.length}</span><span className="tile-l">bahan tidak sesuai resep</span></div>
      </div>
      <p className="help">
        <b>Resep</b> = bahan yang seharusnya terpakai dari porsi terjual. <b>Opname</b> = terpakai menurut hitungan stok
        (stok kemarin + masuk − sisa). Selisih lebih dari 15% ditandai.
      </p>

      {!session && (
        <div className="note">
          <b>Stok opname tanggal ini belum ada.</b>
          <p className="small">Perbandingan muncul setelah hitungan {dateLabel(date)} diisi di <Link href={`/hitung?date=${date}`}>Hitung</Link>.</p>
        </div>
      )}
      {noRecipe.size > 0 && (
        <div className="note">
          <b>Menu tanpa resep, belum ikut dihitung</b>
          <p className="small">{[...noRecipe].map(([m, n]) => `${m} (${n})`).join(", ")}. <Link href="/penjualan/resep">Isi resepnya</Link>.</p>
        </div>
      )}
      {nounit.length > 0 && (
        <div className="note">
          <b>{nounit.length} bahan belum bisa dibandingkan</b>
          <p className="small">
            Resepnya memakai gram/ml, tapi bahan ini dihitung per bungkus, potong atau biji. Isi &quot;isi per kemasan&quot;
            di <Link href="/bahan">Bahan</Link> (mis. 1 bungkus tepung = 1000 gr), atau tulis jumlahnya dalam satuan bahan di{" "}
            <Link href="/penjualan/resep">Resep</Link>. Bahannya ditandai &quot;isi ukuran kemasan&quot; di bawah.
          </p>
        </div>
      )}
      {guessed > 0 && (
        <p className="help">Majoo tidak mencatat jumlah per menu, jadi porsi dihitung dari harga. {guessed} porsi tidak bisa dipastikan dan dihitung 1 per transaksi.</p>
      )}

      {CATEGORIES.map((c) => {
        const g = compare.filter((x) => x.item.category === c);
        if (!g.length) return null;
        return (
          <section className="group" key={c}>
            <h3>{c}</h3>
            <ul className="list">
              {g.map((x) => (
                <li key={x.item.id} className="use-row">
                  <div>
                    <b>{x.item.name}</b>
                    <div className="muted small">
                      {x.e.readable ? `resep ${q(x.e.amount, x.item.unit)}` : "resep belum bisa dihitung"}
                      {(x.state === "ok" || x.state === "lebih" || x.state === "kurang") && ` · opname ${q(x.used, x.item.unit)}`}
                    </div>
                  </div>
                  <div className="use-val">
                    {x.state === "ok" && <span className="pill">Sesuai</span>}
                    {x.state === "lebih" && <span className="pill bad">Lebih {q(x.gap, x.item.unit)}</span>}
                    {x.state === "kurang" && <span className="pill warn">Kurang {q(-x.gap, x.item.unit)}</span>}
                    {x.state === "nounit" && <span className="muted small">isi ukuran kemasan</span>}
                    {x.state === "nocount" && <span className="muted small">belum dihitung</span>}
                    {x.state === "notonlist" && <span className="muted small">tidak ada di stok opname</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {off.length > 0 && (
        <p className="help">
          <b>Lebih</b>: stok berkurang lebih banyak dari resep (takaran berlebih, terbuang, atau belanjaan belum dicatat sebagai masuk).{" "}
          <b>Kurang</b>: stok berkurang lebih sedikit dari resep (takaran kurang, salah hitung, atau resepnya perlu disesuaikan).
        </p>
      )}

      <details className="group">
        <summary className="muted">Porsi terjual per menu ({sold.length} menu)</summary>
        <div className="tbl">
          <table>
            <thead><tr><th style={{ textAlign: "left" }}>Menu</th><th>Shift 1</th><th>Shift 2</th><th>Total</th></tr></thead>
            <tbody>
              {sold.map(([menu, m]) => (
                <tr key={menu}>
                  <td style={{ textAlign: "left" }}>{menu}{m.guessed ? " *" : ""}</td>
                  <td>{m.s1 || "–"}</td><td>{m.s2 || "–"}</td><td><b>{m.total}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {guessed > 0 && <p className="help">* sebagian porsinya tidak bisa dipastikan dari harga.</p>}
      </details>

      <div className="row" style={{ marginTop: 28 }}>
        <Link className="btn" href={`/riwayat/${date}`}>Lihat stok opname</Link>
        <span className="spacer" />
        {hapus === date ? (
          <form action={deleteSalesDay} className="row">
            <input type="hidden" name="date" value={date} />
            <span className="small">Hapus data penjualan tanggal ini?</span>
            <button className="btn danger small">Ya, hapus</button>
            <Link className="btn small" href={`/penjualan/${date}`}>Batal</Link>
          </form>
        ) : (
          <Link className="btn danger small" href={`/penjualan/${date}?hapus=${date}`}>Hapus</Link>
        )}
      </div>
    </>
  );
}
