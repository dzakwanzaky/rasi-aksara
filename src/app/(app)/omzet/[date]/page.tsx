import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { rupiah } from "@/lib/laporan";
import { METHODS, percent, summarize, topMenus, type TrxRow } from "@/lib/omzet";
import { dateLabel } from "@/lib/types";
import { deleteSalesDay } from "../../penjualan/actions";

export const dynamic = "force-dynamic";

const SHIFT_LABEL: Record<string, string> = { "1": "Shift 1", "2": "Shift 2", "": "Tanpa shift" };

export default async function OmzetTanggal({
  params: p, searchParams,
}: { params: Promise<{ date: string }>; searchParams: Promise<{ hapus?: string }> }) {
  const { date } = await p;
  const { hapus } = await searchParams;
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) notFound();

  const { data: day } = await supabase.from("sales_days").select("*").eq("sale_date", date).maybeSingle();
  if (!day) notFound();
  const [{ data: trxRows }, { data: portions }, { data: older }, { data: newer }] = await Promise.all([
    supabase.from("sales_trx").select("trx_no, shift, method, total, products").eq("sale_date", date),
    supabase.from("sales_lines").select("menu, qty, guessed").eq("sale_date", date),
    supabase.from("sales_days").select("sale_date").lt("sale_date", date).order("sale_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("sales_days").select("sale_date").gt("sale_date", date).order("sale_date").limit(1).maybeSingle(),
  ]);
  const trx = (trxRows ?? []) as TrxRow[];
  const s = summarize(trx);
  const shifts = [...s.byShift].sort((a, b) => (a[0] || "9").localeCompare(b[0] || "9"));
  const methods = METHODS.filter((m) => m.id !== "lain" || s.byMethod.lain);

  // Portions per menu, worked out from menu prices on upload (Penjualan tab); only an estimate.
  const porsi = new Map<string, { qty: number; guessed: number }>();
  for (const r of (portions ?? []) as { menu: string; qty: number; guessed: number }[]) {
    const m = porsi.get(r.menu) ?? { qty: 0, guessed: 0 };
    m.qty += r.qty;
    m.guessed += r.guessed;
    porsi.set(r.menu, m);
  }
  const top = topMenus(trx);

  return (
    <>
      <Link className="back" href="/omzet">← Semua omzet</Link>
      <div className="daynav">
        {older ? <Link className="btn small" href={`/omzet/${older.sale_date}`} aria-label="Hari sebelumnya">‹</Link> : <span />}
        <div>
          <p className="eyebrow">Omzet harian</p>
          <h2 className="big">{dateLabel(date)}</h2>
        </div>
        {newer ? <Link className="btn small" href={`/omzet/${newer.sale_date}`} aria-label="Hari berikutnya">›</Link> : <span />}
      </div>

      {!trx.length ? (
        <div className="note">
          <b>Rincian transaksi tanggal ini belum ada</b>
          <p className="small">
            Tanggal ini diupload sebelum fitur Omzet ada (omzet tercatat {rupiah(day.total)}, {day.trx_count} transaksi). Upload ulang
            file Majoo-nya di halaman <Link href="/omzet">Omzet</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="tiles">
            <div className="tile"><span className="tile-n">{rupiah(s.total)}</span><span className="tile-l">omzet · {s.count} transaksi</span></div>
            <div className="tile"><span className="tile-n">{rupiah(s.byMethod.tunai)}</span><span className="tile-l">tunai · {s.countByMethod.tunai} trx · {percent(s.byMethod.tunai, s.total)}</span></div>
            <div className="tile"><span className="tile-n">{rupiah(s.byMethod.qris)}</span><span className="tile-l">QRIS · {s.countByMethod.qris} trx · {percent(s.byMethod.qris, s.total)}</span></div>
            <div className="tile"><span className="tile-n">{rupiah(s.count ? s.total / s.count : 0)}</span><span className="tile-l">rata-rata per transaksi</span></div>
          </div>

          {s.otherMethods.size > 0 && (
            <div className="note">
              <b>Ada metode bayar selain tunai dan QRIS</b>
              <p className="small">{[...s.otherMethods].map(([m, n]) => `${m}: ${rupiah(n)}`).join(" · ")}</p>
            </div>
          )}

          <section className="group">
            <h3>Per shift</h3>
            <div className="tbl">
              <table>
                <thead><tr><th>Shift</th><th>Trx</th>{methods.map((m) => <th key={m.id}>{m.label}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  {shifts.map(([id, v]) => (
                    <tr key={id}>
                      <td>{SHIFT_LABEL[id] ?? id}</td>
                      <td className="n">{v.count}</td>
                      {methods.map((m) => <td key={m.id} className="n">{rupiah(v[m.id])}</td>)}
                      <td className="n"><b>{rupiah(v.total)}</b></td>
                    </tr>
                  ))}
                  <tr>
                    <td><b>Total</b></td>
                    <td className="n"><b>{s.count}</b></td>
                    {methods.map((m) => <td key={m.id} className="n"><b>{rupiah(s.byMethod[m.id])}</b></td>)}
                    <td className="n"><b>{rupiah(s.total)}</b></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="group">
            <h3>Menu terlaris</h3>
            <div className="tbl">
              <table>
                <thead><tr><th>Menu</th><th>Transaksi</th><th>Porsi (perkiraan)</th></tr></thead>
                <tbody>
                  {top.map((t) => {
                    const p = porsi.get(t.menu);
                    return (
                      <tr key={t.menu}>
                        <td>{t.menu}</td>
                        <td className="n"><b>{t.count}</b></td>
                        <td className="n">{p ? `${p.qty}${p.guessed ? " *" : ""}` : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="help">
              <b>Transaksi</b> = berapa transaksi yang memuat menu ini (pasti, dari Majoo). <b>Porsi</b> diperkirakan dari harga menu,
              karena Majoo tidak mencatat jumlah per menu. * sebagian porsinya tidak bisa dipastikan. Harga menu diatur di{" "}
              <Link href="/penjualan/resep">Resep</Link>.
            </p>
          </section>
        </>
      )}

      <div className="row" style={{ marginTop: 28 }}>
        <Link className="btn" href={`/penjualan/${date}`}>Bahan vs stok opname</Link>
        <span className="spacer" />
        {hapus === date ? (
          <form action={deleteSalesDay} className="row">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="from" value="omzet" />
            <span className="small">Hapus data penjualan tanggal ini?</span>
            <button className="btn danger small">Ya, hapus</button>
            <Link className="btn small" href={`/omzet/${date}`}>Batal</Link>
          </form>
        ) : (
          <Link className="btn danger small" href={`/omzet/${date}?hapus=${date}`}>Hapus</Link>
        )}
      </div>
    </>
  );
}
