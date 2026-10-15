import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listSessions, loadItems, loadLinesFor, countDayJakarta } from "@/lib/data";
import { dateLabel, type LineRow } from "@/lib/types";
import { usageSummary } from "@/lib/usage";

const PAGE = 30;

export default async function Riwayat({ searchParams }: { searchParams: Promise<{ lagi?: string }> }) {
  const shown = PAGE * Math.max(1, Number((await searchParams).lagi ?? 1) || 1);
  const supabase = await createClient();
  const [sessions, items] = await Promise.all([listSessions(supabase), loadItems(supabase)]);
  if (!sessions.length) return <p className="empty">Riwayat muncul setelah ada hitungan stok pertama.</p>;

  const page = sessions.slice(0, shown);
  const all = await loadLinesFor(supabase, page.map((s) => s.id));
  const bySession = new Map<string, Map<number, LineRow>>();
  for (const l of all) {
    if (!bySession.has(l.session_id)) bySession.set(l.session_id, new Map());
    bySession.get(l.session_id)!.set(l.item_id, l);
  }
  const today = countDayJakarta();

  return (
    <>
      <p className="eyebrow">Riwayat stok opname</p>
      <h2 className="big">Semua hitungan</h2>
      <p className="help">Tekan satu tanggal untuk lihat sisa stok dan pemakaian tiap bahan di hari itu.</p>
      <ul className="days">
        {page.map((s) => {
          const sum = usageSummary(items, bySession.get(s.id) ?? new Map());
          return (
            <li key={s.id}>
              <Link className="daycard" href={`/riwayat/${s.count_date}`}>
                <div>
                  <b>{dateLabel(s.count_date)}</b>
                  {s.count_date === today && <span className="unit-tag">hari ini</span>}
                  <div className="muted small">
                    {sum.counted ? `${sum.counted} dari ${sum.total} bahan dihitung · ${sum.used} terpakai` : "Belum diisi"}
                    {sum.check ? ` · ${sum.check} perlu dicek` : ""}
                  </div>
                </div>
                <span className="chev" aria-hidden>›</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {sessions.length > shown && (
        <p><Link className="btn" href={`/riwayat?lagi=${shown / PAGE + 1}`}>Tampilkan lebih lama</Link></p>
      )}
    </>
  );
}
