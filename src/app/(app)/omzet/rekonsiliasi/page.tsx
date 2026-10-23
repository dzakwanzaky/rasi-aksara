import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { formatNumber, rupiah, shiftLabel } from "@/lib/laporan";
import { addDays, methodOf } from "@/lib/omzet";
import { dayState, qrisCheck, signed, tunaiCheck, type CashByShift, type Settings, type ShiftReport } from "@/lib/rekon";
import { dateLabel } from "@/lib/types";
import { saveQris, saveSettings } from "../actions";

export const dynamic = "force-dynamic";

const DAYS = 31;
const money = (n: number | null) => (n == null ? "–" : rupiah(n));
const diff = (n: number | null) => (n == null ? "–" : n === 0 ? "pas" : signed(n, rupiah));
const MAJOO_SHIFT: Record<string, string> = { "1": "shift 1", "2": "shift 2", "": "tanpa shift" };

/** Cash rows of the uploaded transactions; Supabase returns at most 1000 rows per request, so read in pages. */
async function cashTrx(supabase: SupabaseClient, from: string, to: string) {
  const out: { sale_date: string; shift: string; method: string; total: number }[] = [];
  for (let page = 0; ; page++) {
    const { data } = await supabase.from("sales_trx").select("sale_date, shift, method, total")
      .gte("sale_date", from).lte("sale_date", to).order("sale_date").order("trx_no").range(page * 1000, page * 1000 + 999);
    out.push(...((data ?? []) as typeof out));
    if (!data || data.length < 1000) return out;
  }
}

export default async function Rekonsiliasi({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    return (
      <section className="panel">
        <h2>Rekonsiliasi</h2>
        <p className="muted">Halaman ini hanya untuk pemilik/admin.</p>
      </section>
    );
  }

  const [{ data: dayRows }, { data: settingsRow, error: dbError }] = await Promise.all([
    supabase.from("sales_days").select("sale_date, total, tunai, qris").order("sale_date", { ascending: false }).limit(DAYS),
    supabase.from("bookkeeping_settings").select("qris_fee_pct, qris_lag_days, batas_selisih").eq("id", 1).maybeSingle(),
  ]);
  if (dbError) {
    return (
      <div className="start">
        <h2 className="big">Rekonsiliasi belum siap</h2>
        <p className="help">
          Jalankan <code>0014_rekonsiliasi.sql</code> di Supabase (SQL Editor), lalu buka halaman ini lagi.
        </p>
        <p className="muted small">{dbError.message}</p>
      </div>
    );
  }
  const settings: Settings = {
    qris_fee_pct: settingsRow?.qris_fee_pct == null ? null : Number(settingsRow.qris_fee_pct),
    qris_lag_days: settingsRow?.qris_lag_days ?? null,
    batas_selisih: settingsRow?.batas_selisih == null ? null : Number(settingsRow.batas_selisih),
  };
  const days = (dayRows ?? []) as { sale_date: string; total: number; tunai: number | null; qris: number | null }[];
  const from = days.at(-1)?.sale_date ?? "9999-12-31";
  const to = days[0]?.sale_date ?? "0000-01-01";

  const [trx, { data: reportRows }, { data: qrisRows }] = await Promise.all([
    cashTrx(supabase, from, to),
    supabase.from("daily_reports").select("report_date, shift, tunai_aktual, modal, pengeluaran").gte("report_date", from).lte("report_date", to),
    supabase.from("qris_masuk").select("sale_date, amount").gte("sale_date", from).lte("sale_date", to),
  ]);

  const cash = new Map<string, CashByShift>();
  for (const t of trx) {
    if (methodOf(t.method) !== "tunai") continue;
    const m = cash.get(t.sale_date) ?? new Map();
    m.set(t.shift, (m.get(t.shift) ?? 0) + Number(t.total));
    cash.set(t.sale_date, m);
  }
  const reports = new Map<string, ShiftReport[]>();
  for (const r of (reportRows ?? []) as (ShiftReport & { report_date: string })[]) {
    reports.set(r.report_date, [...(reports.get(r.report_date) ?? []), r]);
  }
  const qrisIn = new Map(((qrisRows ?? []) as { sale_date: string; amount: number }[]).map((q) => [q.sale_date, Number(q.amount)]));

  const rows = days.map((d) => {
    const t = tunaiCheck(cash.get(d.sale_date) ?? new Map(), reports.get(d.sale_date) ?? []);
    const q = qrisCheck(Number(d.qris ?? 0), qrisIn.get(d.sale_date) ?? null, settings.qris_fee_pct);
    return { d, t, q, ...dayState(t, q, settings.batas_selisih) };
  });
  const besar = rows.filter((r) => r.state === "besar").length;
  const belum = rows.filter((r) => r.state === "belum").length;
  const noSplit = days.some((d) => d.tunai == null);

  return (
    <>
      <Link className="back" href="/omzet">← Omzet</Link>
      <p className="eyebrow">Omzet Majoo vs uang masuk</p>
      <h2 className="big">Rekonsiliasi</h2>
      <p className="help">
        <b>Tunai</b>: hitungan laci dari tab <Link href="/laporan">Laporan</Link> dibandingkan dengan penjualan tunai Majoo + modal −
        pengeluaran dari laci. <b>QRIS</b>: uang yang masuk ke rekening (Anda isi) dibandingkan dengan QRIS Majoo setelah potongan.
      </p>

      <div className="tiles">
        <div className={`tile${besar ? " bad" : ""}`}><span className="tile-n">{besar}</span><span className="tile-l">hari selisih besar</span></div>
        <div className={`tile${belum ? " warn" : ""}`}><span className="tile-n">{belum}</span><span className="tile-l">hari belum lengkap</span></div>
      </div>

      <details className="panel" open={settings.qris_fee_pct == null || settings.batas_selisih == null}>
        <summary><b>Pengaturan</b> <span className="muted">potongan QRIS, jeda, batas selisih</span></summary>
        <form action={saveSettings} className="formgrid" style={{ marginTop: 12 }}>
          <label className="f">
            Potongan QRIS (%)
            <input name="qris_fee_pct" inputMode="decimal" placeholder="belum diisi" defaultValue={settings.qris_fee_pct?.toString().replace(".", ",") ?? ""} />
          </label>
          <label className="f">
            Jeda QRIS masuk (hari)
            <input name="qris_lag_days" inputMode="numeric" placeholder="belum diisi" defaultValue={settings.qris_lag_days ?? ""} />
          </label>
          <label className="f">
            Batas selisih (Rp)
            <input name="batas_selisih" inputMode="numeric" placeholder="belum diisi" defaultValue={formatNumber(settings.batas_selisih)} />
          </label>
          <div className="row"><button className="btn primary">Simpan</button></div>
        </form>
        <p className="help">
          Lihat potongan dan jeda di mutasi rekening atau laporan settlement QRIS. Selama potongan belum diisi, QRIS dibandingkan dengan
          angka kotor, jadi selisihnya ikut memuat potongan. Selama batas belum diisi, tidak ada hari yang ditandai.
        </p>
      </details>

      {error && <p className="error">{error}</p>}
      {noSplit && (
        <p className="note small">Ada hari yang diupload sebelum fitur Omzet. Upload ulang file Majoo-nya di <Link href="/omzet">Omzet</Link> supaya tunai/QRIS-nya terbaca.</p>
      )}

      {rows.length ? (
        <ul className="rk-list">
          {rows.map(({ d, t, q, state, total }) => (
            <li key={d.sale_date} id={`d${d.sale_date}`} className={`rk-day ${state}`}>
              <div className="rk-head">
                <Link href={`/omzet/${d.sale_date}`}><b>{dateLabel(d.sale_date)}</b></Link>
                {state === "besar" && <span className="pill bad">Selisih besar {diff(total)}</span>}
                {state === "ok" && <span className="pill">Selisih {diff(total)}</span>}
                {state === "belum" && <span className="pill warn">Belum lengkap</span>}
              </div>
              <div className="muted small">Omzet Majoo {rupiah(Number(d.total))}</div>

              <div className="rk-grid">
                <div className="rk-part">
                  <b>Tunai</b>
                  <dl>
                    <dt>Majoo</dt><dd>{money(t.majoo)}</dd>
                    <dt>Seharusnya di laci</dt><dd>{money(t.seharusnya)}</dd>
                    <dt>Hitungan laci</dt><dd>{money(t.aktual)}</dd>
                    <dt>Selisih</dt><dd className={t.selisih ? "rk-off" : ""}>{diff(t.selisih)}</dd>
                  </dl>
                  {t.missing.length > 0 && (
                    <p className="small muted">
                      Hitungan laci {t.missing.map((s) => MAJOO_SHIFT[s] ?? shiftLabel(s)).join(" & ")} belum diisi di{" "}
                      <Link href={`/laporan?date=${d.sale_date}`}>Laporan</Link>.
                    </p>
                  )}
                </div>

                <div className="rk-part">
                  <b>QRIS</b>
                  <dl>
                    <dt>Majoo</dt><dd>{money(q.majoo)}</dd>
                    <dt>{q.feeKnown ? `Setelah potongan ${settings.qris_fee_pct!.toString().replace(".", ",")}%` : "Potongan"}</dt>
                    <dd>{q.feeKnown ? money(q.bersih) : "belum diisi"}</dd>
                    <dt>Masuk rekening</dt><dd>{money(q.masuk)}</dd>
                    <dt>Selisih</dt><dd className={q.selisih ? "rk-off" : ""}>{diff(q.selisih)}</dd>
                  </dl>
                  {q.majoo > 0 && (
                    <form action={saveQris} className="rk-form">
                      <input type="hidden" name="date" value={d.sale_date} />
                      <input name="amount" inputMode="numeric" placeholder="QRIS masuk" aria-label={`QRIS masuk untuk ${dateLabel(d.sale_date)}`} defaultValue={formatNumber(q.masuk)} />
                      <button className="btn small">Simpan</button>
                    </form>
                  )}
                  {q.majoo > 0 && settings.qris_lag_days != null && (
                    <p className="small muted">Cek mutasi tanggal {dateLabel(addDays(d.sale_date, settings.qris_lag_days))}.</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Belum ada penjualan. Upload file Majoo dulu di <Link href="/omzet">Omzet</Link>.</p>
      )}

      <details className="group">
        <summary className="muted">Cara menghitung</summary>
        <ul className="help">
          <li><b>Seharusnya di laci</b> = penjualan tunai Majoo + modal − pengeluaran dari laci, per shift. Modal dan pengeluaran diambil dari Laporan (modal kosong dianggap Rp 200.000).</li>
          <li>Kalau Laporan diisi sebagai &quot;Shift 1 &amp; 2&quot;, satu hitungan laci dibandingkan dengan tunai Majoo sehari penuh.</li>
          <li>Hitungan laci diasumsikan sudah termasuk modal. Kalau staff menghitung tanpa modal, selisih tunai akan minus sebesar modal.</li>
          <li><b>QRIS masuk</b> diisi per tanggal penjualan, bukan tanggal uang masuk. Jeda hanya membantu mencari tanggal di mutasi.</li>
          <li>Hari dengan angka yang belum ada ditandai &quot;belum lengkap&quot;, tidak dihitung nol.</li>
          <li>Ditampilkan {DAYS} hari terakhir yang punya upload Majoo.</li>
        </ul>
      </details>
    </>
  );
}
