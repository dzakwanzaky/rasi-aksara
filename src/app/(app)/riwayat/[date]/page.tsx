import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listSessions, loadItems, loadLines } from "@/lib/data";
import { formatQty, parseQty } from "@/lib/qty";
import { usageOf } from "@/lib/usage";
import { CATEGORIES, dateLabel } from "@/lib/types";
import { notFound } from "next/navigation";
import { deleteSession } from "../../actions";

// Terpakai (used) = stok kemarin + barang masuk − sisa sekarang
export default async function RiwayatTanggal({
  params: p, searchParams,
}: { params: Promise<{ date: string }>; searchParams: Promise<{ hapus?: string }> }) {
  const { date } = await p;
  const params = await searchParams;
  const supabase = await createClient();
  const [sessions, items] = await Promise.all([listSessions(supabase), loadItems(supabase)]);
  const idx = sessions.findIndex((s) => s.count_date === date);
  if (idx < 0) notFound();
  const session = sessions[idx];
  const newer = sessions[idx - 1];
  const older = sessions[idx + 1];
  const lines = await loadLines(supabase, session.id);

  const rows = items.map((item) => {
    const l = lines.get(item.id);
    return { item, l, ...usageOf(item, l) };
  });
  const usedCount = rows.filter((r) => r.status === "used").length;
  const notCounted = rows.filter((r) => r.status === "notcounted");
  const check = rows.filter((r) => r.status === "up" || r.status === "unreadable");

  const counted = rows.length - notCounted.length;
  const qty = (n: number | null, unit: string) => (n == null || Number.isNaN(n) ? "–" : `${formatQty(n)} ${unit}`.trim());

  return (
    <>
      <Link className="back" href="/riwayat">← Semua riwayat</Link>
      <div className="daynav">
        {older ? <Link className="btn small" href={`/riwayat/${older.count_date}`} aria-label="Hari sebelumnya">‹</Link> : <span />}
        <div>
          <p className="eyebrow">Hitungan stok</p>
          <h2 className="big">{dateLabel(session.count_date)}</h2>
        </div>
        {newer ? <Link className="btn small" href={`/riwayat/${newer.count_date}`} aria-label="Hari berikutnya">›</Link> : <span />}
      </div>

      {counted === 0 ? (
        <div className="start">
          <h2 className="big">Hitungan tanggal ini belum diisi</h2>
          <p className="muted">Pemakaian muncul setelah sisa stok tiap bahan dihitung. Tekan ‹ atau › di atas untuk lihat hari lain.</p>
          <Link className="btn primary bigbtn" href={`/hitung?date=${session.count_date}`}>Isi hitungan</Link>
        </div>
      ) : (
        <>
          <div className="tiles">
            <div className="tile"><span className="tile-n">{counted}<small>/{rows.length}</small></span><span className="tile-l">bahan dihitung</span></div>
            <div className="tile"><span className="tile-n">{usedCount}</span><span className="tile-l">bahan terpakai</span></div>
            {check.length > 0 && <div className="tile warn"><span className="tile-n">{check.length}</span><span className="tile-l">perlu dicek</span></div>}
          </div>
          <p className="help">Terpakai = stok kemarin + barang masuk − sisa hari ini.</p>

          {check.length > 0 && (
            <div className="note">
              <b>Perlu dicek</b>
              <p className="small">
                Kalau stok naik, biasanya ada belanjaan yang belum dicatat. Isi &quot;barang masuk&quot; di{" "}
                <Link href={`/hitung?date=${session.count_date}`}>Hitung</Link>.
              </p>
              <ul>
                {check.map((r) => (
                  <li key={r.item.id}>
                    {r.item.name}:{" "}
                    {r.status === "up"
                      ? `naik ${formatQty(-r.used)} ${r.item.unit} dari kemarin`
                      : `"${r.l?.tersedia ?? r.l?.masuk}" tidak terbaca sebagai angka`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {CATEGORIES.map((c) => {
            const g = rows.filter((r) => r.item.category === c && r.status !== "notcounted");
            if (!g.length) return null;
            return (
              <section className="group" key={c}>
                <h3>{c}</h3>
                <ul className="list">
                  {g.map((r) => (
                    <li key={r.item.id} className="use-row">
                      <div>
                        <Link className="itemlink" href={`/riwayat/bahan/${r.item.id}`}><b>{r.item.name}</b></Link>
                        <div className="muted small">
                          kemarin {qty(parseQty(r.l?.awal, r.item), r.item.unit)}
                          {parseQty(r.l?.masuk, r.item) ? ` · masuk ${qty(parseQty(r.l?.masuk, r.item), r.item.unit)}` : ""}
                          {" · "}sisa {qty(r.sisa, r.item.unit)}
                        </div>
                      </div>
                      <div className="use-val">
                        {r.status === "used" && <><span className="use-n">{formatQty(r.used)}</span> <span className="muted small">{r.item.unit} terpakai</span></>}
                        {r.status === "same" && <span className="muted small">tidak terpakai</span>}
                        {(r.status === "up" || r.status === "unreadable") && <span className="pill warn">Perlu dicek</span>}
                        {r.status === "noprev" && <span className="muted small">belum ada data kemarin</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {notCounted.length > 0 && (
            <details className="group">
              <summary className="muted">{notCounted.length} bahan belum dihitung di tanggal ini</summary>
              {CATEGORIES.map((c) => {
                const g = notCounted.filter((r) => r.item.category === c);
                if (!g.length) return null;
                return (
                  <div key={c}>
                    <h3>{c}</h3>
                    <ul className="namecols">{g.map((r) => <li key={r.item.id}>{r.item.name}</li>)}</ul>
                  </div>
                );
              })}
            </details>
          )}
        </>
      )}

      <div className="row" style={{ marginTop: 28 }}>
        <Link className="btn" href={`/hitung?date=${session.count_date}`}>Ubah hitungan ini</Link>
        <a className="btn" href={`/pemakaian/csv?date=${session.count_date}`}>Unduh Excel (CSV)</a>
        <span className="spacer" />
        {params.hapus === session.count_date ? (
          <form action={deleteSession} className="row">
            <input type="hidden" name="id" value={session.id} />
            <span className="small">Hapus hitungan ini beserta semua angkanya?</span>
            <button className="btn danger small">Ya, hapus</button>
            <Link className="btn small" href={`/riwayat/${session.count_date}`}>Batal</Link>
          </form>
        ) : (
          <Link className="btn danger small" href={`/riwayat/${session.count_date}?hapus=${session.count_date}`}>Hapus</Link>
        )}
      </div>
    </>
  );
}
