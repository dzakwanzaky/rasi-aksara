import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateLabel, type Session } from "@/lib/types";
import { createSession } from "../actions";

export default async function OpnameList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("opname_sessions")
    .select("id, count_date, note, created_at")
    .order("count_date", { ascending: false })
    .order("created_at", { ascending: false });
  const sessions = (data ?? []) as Session[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <form action={createSession} className="panel">
        <h2>Mulai opname baru</h2>
        <p className="help">
          Kolom Awal otomatis diisi dari Tersedia di opname terakhir
          {sessions[0] ? ` (${dateLabel(sessions[0].count_date)})` : ""}. Isi Masuk untuk barang yang dibeli sejak itu,
          lalu hitung Tersedia.
        </p>
        <div className="row">
          <label className="f">Tanggal<input id="count_date" type="date" name="count_date" defaultValue={today} /></label>
          <label className="f" style={{ flex: "1 1 180px" }}>
            Catatan (opsional)<input id="note" name="note" placeholder="mis. shift pagi" />
          </label>
          <button className="btn primary" style={{ alignSelf: "flex-end" }}>Buat</button>
        </div>
      </form>

      <h2 style={{ marginTop: 24 }}>Opname sebelumnya</h2>
      {sessions.length === 0 ? (
        <p className="empty">Belum ada opname.</p>
      ) : (
        <div className="panel items" style={{ padding: 0 }}>
          {sessions.map((s) => (
            <div className="it" key={s.id}>
              <div>
                <b>{dateLabel(s.count_date)}</b> <span className="muted">{s.note}</span>
              </div>
              <Link className="btn small" href={`/opname/${s.id}`}>Buka</Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
