import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { rupiah } from "@/lib/laporan";
import { addDays, percent, weeks, type DayTotals } from "@/lib/omzet";
import { dateLabel } from "@/lib/types";
import { uploadSales } from "../penjualan/actions";
import { UploadButton } from "../penjualan/UploadButton";

export const dynamic = "force-dynamic";

const short = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const money = (n: number | null) => (n == null ? "–" : rupiah(n));

export default async function Omzet({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    return (
      <section className="panel">
        <h2>Omzet</h2>
        <p className="muted">Halaman ini hanya untuk pemilik/admin.</p>
      </section>
    );
  }
  const { data, error: dbError } = await supabase
    .from("sales_days").select("sale_date, trx_count, total, tunai, qris, lain").order("sale_date", { ascending: false }).limit(120);
  if (dbError) {
    return (
      <div className="start">
        <h2 className="big">Omzet belum siap</h2>
        <p className="help">
          Tabel penjualan belum lengkap di database. Jalankan <code>0012_penjualan_resep.sql</code> lalu <code>0013_omzet.sql</code> di
          Supabase (SQL Editor), lalu buka halaman ini lagi.
        </p>
        <p className="muted small">{dbError.message}</p>
      </div>
    );
  }
  const days = (data ?? []) as DayTotals[];
  const week = weeks(days);
  const oldUploads = days.filter((d) => d.tunai == null).length;

  return (
    <>
      <p className="eyebrow">Omzet harian dari Majoo</p>
      <h2 className="big">Omzet</h2>

      <form action={uploadSales} className="panel">
        <input type="hidden" name="from" value="omzet" />
        <label className="f">
          File Excel dari Majoo (.xlsx)
          <input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        </label>
        <p className="help">
          Di Majoo: Laporan › Penjualan › Detail Penjualan, pilih tanggal, lalu Export. Satu file boleh berisi beberapa hari.
          Upload ulang tanggal yang sama menimpa data lama.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="row"><UploadButton /></div>
      </form>

      {oldUploads > 0 && (
        <div className="note">
          <b>{oldUploads} hari belum punya rincian tunai/QRIS</b>
          <p className="small">Hari itu diupload sebelum fitur Omzet ada. Upload ulang file Majoo-nya supaya rinciannya muncul.</p>
        </div>
      )}

      {days.length ? (
        <>
          <section className="group">
            <h3>Per minggu (Senin–Minggu)</h3>
            <div className="tbl">
              <table>
                <thead><tr><th>Minggu</th><th>Hari</th><th>Trx</th><th>Omzet</th><th>Tunai</th><th>QRIS</th><th>Rata-rata/hari</th></tr></thead>
                <tbody>
                  {week.map((w) => (
                    <tr key={w.start}>
                      <td>{short(w.start)} – {short(addDays(w.start, 6))}</td>
                      <td className="n">{w.days}</td>
                      <td className="n">{w.count}</td>
                      <td className="n"><b>{rupiah(w.total)}</b></td>
                      <td className="n">{w.splitKnown ? rupiah(w.split.tunai) : "–"}</td>
                      <td className="n">{w.splitKnown ? rupiah(w.split.qris) : "–"}</td>
                      <td className="n">{rupiah(w.total / w.days)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="help">Hari hanya dihitung kalau file Majoo-nya sudah diupload. Minggu yang belum lengkap ditandai dengan jumlah hari di bawah 7.</p>
          </section>

          <section className="group">
            <h3>Per hari</h3>
            <div className="tbl">
              <table>
                <thead><tr><th>Tanggal</th><th>Trx</th><th>Omzet</th><th>Tunai</th><th>QRIS</th><th>Lainnya</th></tr></thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.sale_date}>
                      <td><Link href={`/omzet/${d.sale_date}`}>{dateLabel(d.sale_date)}</Link></td>
                      <td className="n">{d.trx_count}</td>
                      <td className="n"><b>{rupiah(d.total)}</b></td>
                      <td className="n">{money(d.tunai)}{d.tunai != null && <div className="sub">{percent(d.tunai, d.total)}</div>}</td>
                      <td className="n">{money(d.qris)}{d.qris != null && <div className="sub">{percent(d.qris, d.total)}</div>}</td>
                      <td className="n">{d.lain ? rupiah(d.lain) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <p className="empty">Belum ada penjualan yang diupload.</p>
      )}

      <details className="group">
        <summary className="muted">Cara menghitung</summary>
        <ul className="help">
          <li><b>Omzet</b> = jumlah kolom &quot;Total Penjualan (Rp)&quot; semua transaksi di file Majoo. Ini sama dengan &quot;Total Penjualan&quot; di kepala laporan Majoo, bukan &quot;Total Penjualan Bersih&quot;.</li>
          <li><b>Tanggal</b> diambil dari &quot;Waktu Order&quot;. Transaksi sebelum jam 06.00 masuk ke hari sebelumnya, sama seperti stok opname.</li>
          <li><b>Tunai</b> = metode &quot;Cash&quot;. <b>QRIS</b> = metode yang memuat &quot;Qris&quot;. Metode lain atau pembayaran campuran masuk <b>Lainnya</b>.</li>
        </ul>
      </details>
    </>
  );
}
