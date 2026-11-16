import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayJakarta } from "@/lib/data";
import { isAdmin } from "@/lib/admin";
import { accountLabel } from "@/lib/staff";
import {
  JADWAL, addDays, dayLong, dayShort, displayName, jadwalInfo, weekStart, type ScheduleRow,
} from "@/lib/jadwal";

export const dynamic = "force-dynamic";

const isDate = (s?: string) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? "");

function ShiftCard({ title, date, row }: { title: string; date: string; row?: ScheduleRow }) {
  const info = jadwalInfo(row?.shift);
  return (
    <div className={`jd-card ${row?.shift ?? "none"}`}>
      <p className="eyebrow">{title}</p>
      <p className="jd-card-shift">{info ? info.label : "Belum ada"}</p>
      <p className="jd-card-hours">{info?.hours || (info ? "Tidak masuk" : "Jadwal belum diisi")}</p>
      <p className="muted small">{dayLong(date)}</p>
    </div>
  );
}

function Week({ title, start, today, byDate }: { title: string; start: string; today: string; byDate: Map<string, ScheduleRow> }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <section className="ck-section">
      <h3>{title}</h3>
      <ul className="jd-week panel">
        {days.map((d) => {
          const info = jadwalInfo(byDate.get(d)?.shift);
          return (
            <li key={d} className={d === today ? "today" : d < today ? "past" : undefined}>
              <span className="jd-day">{dayLong(d)}{d === today && <span className="flag warn">hari ini</span>}</span>
              {info ? <span className={`jd-pill ${info.id}`}>{info.label}{info.hours && <small> {info.hours}</small>}</span> : <span className="muted small">–</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function JadwalPage({ searchParams }: { searchParams: Promise<{ v?: string; d?: string }> }) {
  const params = await searchParams;
  const today = todayJakarta();
  const supabase = await createClient();
  const [{ data: { session } }, admin] = await Promise.all([supabase.auth.getSession(), isAdmin(supabase)]);
  const me = accountLabel(session?.user.email);

  const day = isDate(params.d) ? params.d! : today;
  const thisWeek = weekStart(today);
  const view = params.v === "semua" ? "semua" : params.v === "saya" ? "saya" : null;

  const { data: mineData, error } = await supabase.from("shift_schedule").select("work_date, name, username, shift")
    .eq("username", me).gte("work_date", today.slice(0, 8) + "01").lte("work_date", addDays(thisWeek, 13));

  if (error) {
    return (
      <div className="start">
        <h2 className="big">Jadwal belum siap</h2>
        <p className="help">Jalankan file <code>0018_jadwal_shift.sql</code> di Supabase (SQL Editor), lalu buka halaman ini lagi.</p>
        <p className="muted small">{error.message}</p>
      </div>
    );
  }

  const mine = (mineData ?? []) as ScheduleRow[];
  // Someone without a schedule of their own (e.g. the owner) lands on "Semua".
  const tab = view ?? (mine.length ? "saya" : "semua");

  const header = (
    <>
      <div className="bar">
        <div>
          <p className="eyebrow">Jadwal shift</p>
          <h2 className="big">{tab === "saya" ? "Jadwal saya" : "Semua staff"}</h2>
        </div>
        <span className="spacer" />
        {admin && <Link className="btn small" href="/jadwal/atur">Atur jadwal</Link>}
      </div>
      <div className="filters">
        <Link className="chip" aria-pressed={tab === "saya"} href="/jadwal?v=saya">Jadwal saya</Link>
        <Link className="chip" aria-pressed={tab === "semua"} href="/jadwal?v=semua">Semua</Link>
      </div>
    </>
  );

  if (tab === "saya") {
    const byDate = new Map(mine.map((r) => [r.work_date, r]));
    const month = mine.filter((r) => r.work_date.slice(0, 7) === today.slice(0, 7));
    return (
      <>
        {header}
        {!mine.length ? (
          <p className="empty">Jadwalmu belum ada. Kalau namamu ada di jadwal, minta admin menghubungkan nama itu ke akun <b>{me}</b>.</p>
        ) : (
          <>
            <div className="jd-cards">
              <ShiftCard title="Hari ini" date={today} row={byDate.get(today)} />
              <ShiftCard title="Besok" date={addDays(today, 1)} row={byDate.get(addDays(today, 1))} />
            </div>
            <Week title="Minggu ini" start={thisWeek} today={today} byDate={byDate} />
            <Week title="Minggu depan" start={addDays(thisWeek, 7)} today={today} byDate={byDate} />
            <p className="muted small">
              Bulan ini: {JADWAL.map((j) => `${month.filter((r) => r.shift === j.id).length} ${j.label.toLowerCase()}`).join(" · ")}
            </p>
          </>
        )}
      </>
    );
  }

  // Semua: the week of the chosen day as a grid, and who works that day.
  const start = weekStart(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const { data: weekData } = await supabase.from("shift_schedule").select("work_date, name, username, shift")
    .gte("work_date", start).lte("work_date", days[6]);
  const week = (weekData ?? []) as ScheduleRow[];
  const names = [...new Set(week.map((r) => r.name))].sort((a, b) => a.localeCompare(b));
  const cell = new Map(week.map((r) => [`${r.work_date}|${r.name}`, r]));
  const onDay = week.filter((r) => r.work_date === day);
  const link = (d: string) => `/jadwal?v=semua&d=${d}`;

  return (
    <>
      {header}
      <div className="daynav">
        <Link className="btn small" href={link(addDays(day, -1))} aria-label="Hari sebelumnya">‹</Link>
        <div>
          <h2 className="big">{day === today ? "Hari ini" : day === addDays(today, 1) ? "Besok" : dayLong(day)}</h2>
          {(day === today || day === addDays(today, 1)) && <p className="muted">{dayLong(day)}</p>}
        </div>
        <Link className="btn small" href={link(addDays(day, 1))} aria-label="Hari berikutnya">›</Link>
      </div>

      {!onDay.length && <p className="empty">Belum ada jadwal untuk tanggal ini.</p>}
      <div className="jd-today">
        {JADWAL.map((j) => {
          const who = onDay.filter((r) => r.shift === j.id);
          if (!who.length) return null;
          return (
            <div key={j.id} className={`panel jd-group ${j.id}`}>
              <p className="eyebrow">{j.label}{j.hours && ` · ${j.hours}`} · {who.length} orang</p>
              <p className="jd-names">
                {who.map((r) => <span key={r.name} className={r.username && r.username === me ? "me" : undefined}>{displayName(r.name)}</span>)}
              </p>
            </div>
          );
        })}
      </div>

      {names.length > 0 && (
        <section className="ck-section">
          <h3>Minggu {dayLong(start)} – {dayLong(days[6])}</h3>
          <div className="tbl jd-grid">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  {days.map((d) => (
                    <th key={d} className={d === day ? "sel" : d === today ? "today" : undefined}>
                      <Link href={link(d)}>{dayShort(d)}<br />{Number(d.slice(8))}</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {names.map((n) => (
                  <tr key={n} className={week.some((r) => r.name === n && r.username === me) ? "me" : undefined}>
                    <td>{displayName(n)}</td>
                    {days.map((d) => {
                      const info = jadwalInfo(cell.get(`${d}|${n}`)?.shift);
                      return <td key={d} className={`jd-c ${info?.id ?? ""}${d === day ? " sel" : ""}`}>{info?.short ?? ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">P = Pagi 07.00–15.00 · M = Malam 14.30–22.30 · L = Libur. Tap tanggal untuk melihat siapa yang masuk.</p>
        </section>
      )}
    </>
  );
}
