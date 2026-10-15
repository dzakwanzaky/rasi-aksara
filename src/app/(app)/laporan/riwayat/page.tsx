import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateLabel } from "@/lib/types";
import { SHIFTS, rupiah, selisih, shiftLabel, totals, type Report } from "@/lib/laporan";

const monthLabel = (ym: string) =>
  new Date(ym + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
const shiftOrder = (s: string) => SHIFTS.findIndex((x) => x.id === s);

export default async function RiwayatLaporan({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("daily_reports").select("*")
    .order("report_date", { ascending: false }).limit(1000);
  if (error) return <p className="empty">Laporan harian belum aktif. Jalankan file 0010_laporan_harian.sql di Supabase dulu.</p>;

  const reports = (data ?? []) as Report[];
  if (!reports.length) return <p className="empty">Riwayat muncul setelah ada laporan pertama.</p>;
  const months = [...new Set(reports.map((r) => r.report_date.slice(0, 7)))];
  const wanted = (await searchParams).bulan;
  const month = months.includes(wanted ?? "") ? wanted! : months[0];
  const shown = reports.filter((r) => r.report_date.startsWith(month))
    .sort((a, b) => b.report_date.localeCompare(a.report_date) || shiftOrder(a.shift) - shiftOrder(b.shift));
  const t = totals(shown);

  return (
    <>
      <Link className="back" href="/laporan">‹ Laporan hari ini</Link>
      <p className="eyebrow">Riwayat laporan harian</p>
      <h2 className="big">{monthLabel(month)}</h2>
      {months.length > 1 && (
        <div className="filters">
          {months.map((m) => (
            <Link key={m} className="chip" aria-pressed={m === month} href={`/laporan/riwayat?bulan=${m}`}>{monthLabel(m)}</Link>
          ))}
        </div>
      )}

      <div className="lp-total">
        <div><span className="muted">Total omset</span><b>{rupiah(t.omset)}</b></div>
        <div><span className="muted">Pengeluaran</span><b>{rupiah(t.pengeluaran)}</b></div>
        <div><span className="muted">Total plus</span><b className="lp-plus">{rupiah(t.plus)}</b></div>
        <div><span className="muted">Total minus</span><b className={t.minus ? "lp-minus" : undefined}>{rupiah(Math.abs(t.minus))}</b></div>
      </div>

      <ul className="days">
        {shown.map((r) => {
          const d = selisih(r);
          return (
            <li key={r.report_date + r.shift}>
              <Link className="daycard" href={`/laporan?date=${r.report_date}&shift=${r.shift}`}>
                <div>
                  <b>{dateLabel(r.report_date)}</b> <span className="unit-tag">{shiftLabel(r.shift)}</span>
                  <div className="muted small">
                    Omset {r.omset != null ? rupiah(r.omset) : "–"}
                    {r.pengeluaran ? ` · keluar ${rupiah(r.pengeluaran)}` : ""}
                  </div>
                </div>
                <span className="lp-diff">
                  {d == null ? <span className="pill">Belum lengkap</span>
                    : d > 0 ? <span className="pill">Plus {rupiah(d)}</span>
                    : d < 0 ? <span className="pill bad">Minus {rupiah(-d)}</span>
                    : <span className="pill">Pas</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
