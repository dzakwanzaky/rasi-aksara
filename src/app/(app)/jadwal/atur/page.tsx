import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayJakarta } from "@/lib/data";
import { isAdmin } from "@/lib/admin";
import { listAccounts } from "@/lib/jadwal-server";
import { daysInMonth, displayName, monthDate, monthLabel, type ScheduleRow } from "@/lib/jadwal";
import { linkName } from "../actions";
import { UploadPreview } from "./UploadPreview";
import { MonthGrid } from "./MonthGrid";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export default async function AturJadwal({ searchParams }: { searchParams: Promise<{ m?: string; ok?: string }> }) {
  const params = await searchParams;
  const today = todayJakarta();
  const month = /^\d{4}-\d{2}$/.test(params.m ?? "") ? params.m! : today.slice(0, 7);
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/jadwal");

  const days = daysInMonth(month);
  const [{ data, error }, accounts] = await Promise.all([
    supabase.from("shift_schedule").select("work_date, name, username, shift")
      .gte("work_date", monthDate(month, 1)).lte("work_date", monthDate(month, days)),
    listAccounts(),
  ]);

  if (error) {
    return (
      <div className="start">
        <h2 className="big">Jadwal belum siap</h2>
        <p className="help">Jalankan file <code>0018_jadwal_shift.sql</code> di Supabase (SQL Editor), lalu buka halaman ini lagi.</p>
        <p className="muted small">{error.message}</p>
      </div>
    );
  }

  const rows = (data ?? []) as ScheduleRow[];
  const unlinked = [...new Set(rows.filter((r) => !r.username).map((r) => r.name))].sort();
  const linked = new Map(rows.filter((r) => r.username).map((r) => [r.name, r.username]));

  return (
    <>
      <p><Link href="/jadwal" className="muted">‹ Jadwal</Link></p>
      <div className="daynav">
        <Link className="btn small" href={`/jadwal/atur?m=${shiftMonth(month, -1)}`} aria-label="Bulan sebelumnya">‹</Link>
        <div>
          <p className="eyebrow">Atur jadwal</p>
          <h2 className="big">{monthLabel(month)}</h2>
        </div>
        <Link className="btn small" href={`/jadwal/atur?m=${shiftMonth(month, 1)}`} aria-label="Bulan berikutnya">›</Link>
      </div>

      {params.ok && <p className="panel notice ok">Jadwal {monthLabel(month)} tersimpan. Staff sudah bisa melihatnya di tab Jadwal.</p>}

      {unlinked.length > 0 && (
        <section className="panel">
          <h2>Hubungkan nama ke akun</h2>
          <p className="help">Nama ini belum terhubung ke akun staff, jadi orangnya belum bisa melihat jadwalnya sendiri.</p>
          <ul className="jd-match">
            {unlinked.map((n) => (
              <li key={n}>
                <form action={linkName} className="row">
                  <input type="hidden" name="name" value={n} />
                  <b>{displayName(n)}</b>
                  <select name="username" aria-label={`Akun untuk ${n}`} required defaultValue="">
                    <option value="" disabled>pilih akun…</option>
                    {accounts.map((a) => <option key={a.username} value={a.username}>{a.username}{a.name ? ` (${a.name})` : ""}</option>)}
                  </select>
                  <SubmitButton className="btn small primary">Hubungkan</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <MonthGrid key={month + rows.length} month={month} days={days} today={today} rows={rows} />

      {linked.size > 0 && (
        <details className="muted small" style={{ marginBlock: 10 }}>
          <summary>Nama dan akunnya</summary>
          <ul className="jd-match">
            {[...linked].map(([n, u]) => (
              <li key={n}>
                <form action={linkName} className="row">
                  <input type="hidden" name="name" value={n} />
                  <b>{displayName(n)}</b>
                  <select name="username" aria-label={`Akun untuk ${n}`} defaultValue={u ?? ""}>
                    <option value="">– tidak ada akun –</option>
                    {accounts.map((a) => <option key={a.username} value={a.username}>{a.username}{a.name ? ` (${a.name})` : ""}</option>)}
                  </select>
                  <SubmitButton className="btn small">Ganti</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}

      <UploadPreview month={month} />
    </>
  );
}
