import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listSessions, loadItems, loadLines } from "@/lib/data";
import { formatQty, parseQty } from "@/lib/qty";
import { CATEGORIES, dateLabel } from "@/lib/types";
import { deleteSession } from "../actions";
import { DatePick } from "./DatePick";

// Terpakai (used) = stok kemarin + barang masuk − sisa sekarang
export default async function Pemakaian({ searchParams }: { searchParams: Promise<{ date?: string; hapus?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const [sessions, items] = await Promise.all([listSessions(supabase), loadItems(supabase)]);
  if (!sessions.length) return <p className="empty">Pemakaian muncul setelah ada hitungan stok pertama.</p>;
  const session = sessions.find((s) => s.count_date === params.date) ?? sessions[0];
  const lines = await loadLines(supabase, session.id);

  const rows = items.map((item) => {
    const l = lines.get(item.id);
    const kemarin = parseQty(l?.awal, item);
    const masuk = parseQty(l?.masuk, item) ?? 0;
    const sisa = parseQty(l?.tersedia, item);
    const ok = (x: number | null): x is number => x != null && !Number.isNaN(x);
    let status: "used" | "same" | "up" | "notcounted" | "noprev" | "unreadable";
    let used = 0;
    if (sisa == null) status = "notcounted";
    else if (Number.isNaN(sisa) || Number.isNaN(masuk) || Number.isNaN(kemarin)) status = "unreadable";
    else if (!ok(kemarin)) status = "noprev";
    else {
      used = kemarin + masuk - sisa;
      status = used > 1e-9 ? "used" : used < -1e-9 ? "up" : "same";
    }
    return { item, l, sisa, used, status };
  });
  const usedCount = rows.filter((r) => r.status === "used").length;
  const notCounted = rows.filter((r) => r.status === "notcounted");
  const check = rows.filter((r) => r.status === "up" || r.status === "unreadable");

  return (
    <>
      <div className="bar">
        <div>
          <p className="eyebrow">Pemakaian bahan</p>
          <h2 className="big">{dateLabel(session.count_date)}</h2>
        </div>
        <span className="spacer" />
        <DatePick dates={sessions.map((s) => ({ value: s.count_date, label: dateLabel(s.count_date) }))} current={session.count_date} />
      </div>
      <p className="help">
        Terpakai = stok kemarin + barang masuk − sisa hari ini. {usedCount} bahan terpakai
        {check.length ? `, ${check.length} perlu dicek` : ""}.
      </p>

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
                <li key={r.item.id} className="list-row">
                  <div>
                    <b>{r.item.name}</b>
                    {r.sisa != null && !Number.isNaN(r.sisa) && (
                      <span className="muted small"> · sisa {formatQty(r.sisa)} {r.item.unit}</span>
                    )}
                  </div>
                  {r.status === "used" && <span className="pill">Terpakai {formatQty(r.used)} {r.item.unit}</span>}
                  {r.status === "same" && <span className="muted small">Tidak terpakai</span>}
                  {r.status === "up" && <span className="pill warn">Perlu dicek</span>}
                  {r.status === "unreadable" && <span className="pill warn">Perlu dicek</span>}
                  {r.status === "noprev" && <span className="muted small">Tidak ada data kemarin</span>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {notCounted.length > 0 && (
        <details className="group">
          <summary className="muted">{notCounted.length} bahan belum dihitung di tanggal ini</summary>
          <p className="muted small">{notCounted.map((r) => r.item.name).join(", ")}</p>
        </details>
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
            <Link className="btn small" href={`/pemakaian?date=${session.count_date}`}>Batal</Link>
          </form>
        ) : (
          <Link className="btn danger small" href={`/pemakaian?date=${session.count_date}&hapus=${session.count_date}`}>Hapus</Link>
        )}
      </div>
    </>
  );
}
