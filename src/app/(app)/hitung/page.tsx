import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listSessions, loadItems, loadLines, todayJakarta } from "@/lib/data";
import { dateLabel } from "@/lib/types";
import { openCount, syncCarryOver } from "@/lib/session";
import { startCount } from "../actions";
import { CountFlow } from "./CountFlow";

export default async function Hitung({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const today = todayJakarta();
  const date = (await searchParams).date ?? today;
  const supabase = await createClient();
  const sessions = await listSessions(supabase);
  let session = sessions.find((s) => s.count_date === date);
  const { data: { session: auth } } = await supabase.auth.getSession();

  // Today opens by itself once there is an earlier count, so the morning shift sees last night's stock
  // straight away and can add what came in.
  if (!session && date === today && sessions.some((s) => s.count_date < date)) {
    const id = await openCount(supabase, date, auth?.user.id);
    session = { id, count_date: date, note: "", created_at: new Date().toISOString() };
  }

  if (!session) {
    const last = sessions[0];
    return (
      <div className="start">
        <p className="eyebrow">{dateLabel(date)}</p>
        <h2 className="big">Belum ada hitungan stok {date === today ? "hari ini" : "untuk tanggal ini"}</h2>
        <p className="help">
          Hitung sisa setiap bahan di akhir shift. Angka kemarin
          {last ? ` (${dateLabel(last.count_date)})` : ""} sudah disiapkan sebagai pembanding.
        </p>
        <form action={startCount}>
          <input type="hidden" name="count_date" value={date} />
          <button className="btn primary bigbtn">Mulai hitung stok</button>
        </form>
        {last && (
          <p className="muted">
            Hitungan terakhir: <Link href={`/riwayat/${last.count_date}`}>{dateLabel(last.count_date)}</Link>
          </p>
        )}
      </div>
    );
  }

  const prevDate = await syncCarryOver(supabase, session.id, session.count_date, auth?.user.id);
  const [items, lines] = await Promise.all([loadItems(supabase), loadLines(supabase, session.id)]);
  return (
    <CountFlow
      sessionId={session.id}
      dateText={dateLabel(session.count_date)}
      date={session.count_date}
      isToday={session.count_date === today}
      prevDateText={prevDate ? dateLabel(prevDate) : null}
      items={items}
      initialLines={Object.fromEntries([...lines].map(([id, l]) => [id, { awal: l.awal, masuk: l.masuk, tersedia: l.tersedia }]))}
    />
  );
}
