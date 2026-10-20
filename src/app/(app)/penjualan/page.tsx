import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { rupiah } from "@/lib/laporan";
import { dateLabel } from "@/lib/types";
import { uploadSales } from "./actions";
import { UploadButton } from "./UploadButton";

export const dynamic = "force-dynamic";

type Day = { sale_date: string; trx_count: number; total: number; uploaded_by_name: string | null };

export default async function Penjualan({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    return (
      <section className="panel">
        <h2>Penjualan</h2>
        <p className="muted">Halaman ini hanya untuk pemilik/admin.</p>
      </section>
    );
  }
  const { data } = await supabase.from("sales_days").select("sale_date, trx_count, total, uploaded_by_name").order("sale_date", { ascending: false }).limit(60);
  const days = (data ?? []) as Day[];

  return (
    <>
      <p className="eyebrow">Penjualan vs stok opname</p>
      <h2 className="big">Bahan seharusnya terpakai</h2>
      <p className="help">
        Upload export <b>Detail Penjualan</b> dari Majoo. Aplikasi menghitung bahan yang seharusnya terpakai menurut{" "}
        <Link href="/penjualan/resep">resep</Link>, lalu membandingkannya dengan hasil stok opname di tanggal yang sama.
      </p>

      <form action={uploadSales} className="panel">
        <label className="f">
          File Excel dari Majoo (.xlsx)
          <input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        </label>
        <p className="help">Di Majoo: Laporan › Penjualan › Detail Penjualan, pilih tanggal, lalu Export. Upload ulang tanggal yang sama akan menimpa data lama.</p>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <UploadButton />
          <span className="spacer" />
          <Link className="btn" href="/penjualan/resep">Atur resep</Link>
        </div>
      </form>

      {days.length ? (
        <ul className="days">
          {days.map((d) => (
            <li key={d.sale_date}>
              <Link className="daycard" href={`/penjualan/${d.sale_date}`}>
                <div>
                  <b>{dateLabel(d.sale_date)}</b>
                  <div className="muted small">{d.trx_count} transaksi · {rupiah(d.total)}</div>
                </div>
                <span className="chev" aria-hidden>›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Belum ada penjualan yang diupload.</p>
      )}
    </>
  );
}
