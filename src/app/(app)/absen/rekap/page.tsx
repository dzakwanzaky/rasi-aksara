import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayJakarta } from "@/lib/data";
import { dateLabel } from "@/lib/types";
import { isAdmin } from "@/lib/admin";
import { SHIFTS, clock, durationLabel, minutesWorked, summarize, type AttendanceRow } from "@/lib/absen";
import { DatePick } from "../../checklist/DatePick";
import { deleteAttendance, fixClockOut, saveLocation } from "../actions";
import { HereButton } from "./HereButton";

const shiftDay = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const monthName = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

const meters = (m: number | null) => (m == null ? "" : `${Math.round(m)} m`);

export default async function Rekap({ searchParams }: { searchParams: Promise<{ date?: string; error?: string }> }) {
  const params = await searchParams;
  const today = todayJakarta();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") && params.date! <= today ? params.date! : today;
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/absen");

  const monthStart = date.slice(0, 8) + "01";
  const cols = "id, username, work_date, shift, clock_in, clock_out, in_dist_m, out_dist_m, koreksi";
  const [{ data: dayRows, error }, { data: monthRows }, { data: place }] = await Promise.all([
    // in_photo/out_photo arrive with 0016; select("*") keeps the page working before that migration is run.
    supabase.from("attendance").select("*").eq("work_date", date).order("clock_in"),
    supabase.from("attendance").select(cols).gte("work_date", monthStart).lte("work_date", date),
    supabase.from("attendance_settings").select("lat, lng, radius_m, updated_by_name, updated_at").eq("id", 1).maybeSingle(),
  ]);

  if (error) {
    return (
      <div className="start">
        <h2 className="big">Absen belum siap</h2>
        <p className="help">Jalankan file <code>0015_absensi.sql</code> di Supabase (SQL Editor), lalu buka halaman ini lagi.</p>
        <p className="muted small">{error.message}</p>
      </div>
    );
  }

  const rows = (dayRows ?? []) as AttendanceRow[];
  const photoPaths = rows.flatMap((r) => [r.in_photo, r.out_photo]).filter((p): p is string => !!p);
  const signed = photoPaths.length
    ? (await supabase.storage.from("absen-photos").createSignedUrls(photoPaths, 60 * 60 * 12)).data
    : [];
  const urlOf = new Map((signed ?? []).map((u) => [u.path, u.signedUrl]));
  const selfie = (path: string | null | undefined, label: string) => {
    const url = path ? urlOf.get(path) : null;
    return url ? (
      <a href={url} target="_blank" rel="noreferrer" className="ab-selfie">
        <img src={url} alt={`Selfie ${label}`} loading="lazy" />
        <small>{label}</small>
      </a>
    ) : null;
  };
  const month = summarize((monthRows ?? []) as AttendanceRow[], today);
  const next = shiftDay(date, 1);

  return (
    <>
      <p><Link href="/absen" className="muted">‹ Absen</Link></p>
      <div className="daynav">
        <Link className="btn small" href={`/absen/rekap?date=${shiftDay(date, -1)}`} aria-label="Hari sebelumnya">‹</Link>
        <div>
          <p className="eyebrow">Rekap absensi</p>
          <h2 className="big">{date === today ? "Hari ini" : dateLabel(date)}</h2>
          {date === today && <p className="muted">{dateLabel(date)}</p>}
          <DatePick date={date} today={today} path="/absen/rekap" />
        </div>
        {next <= today ? <Link className="btn small" href={`/absen/rekap?date=${next}`} aria-label="Hari berikutnya">›</Link> : <span />}
      </div>

      {params.error && <p className="error">{params.error}</p>}

      {rows.length === 0 && <p className="empty">Tidak ada yang clock in di tanggal ini.</p>}
      {SHIFTS.map((s) => {
        const inShift = rows.filter((r) => r.shift === s.id);
        if (!inShift.length) return null;
        return (
          <section key={s.id} className="ck-section">
            <h3>{s.label} · {s.hours} · {inShift.length} orang</h3>
            <ul className="ab-rekap">
              {inShift.map((r) => (
                <li key={r.id} className="panel">
                  <div className="card-head">
                    <b>{r.username}</b>
                    <span className="mono">{durationLabel(minutesWorked(r))}</span>
                  </div>
                  <p className="ab-times">
                    Masuk <b>{clock(r.clock_in)}</b> <span className="muted small">({meters(r.in_dist_m)})</span>
                    {" · "}Keluar{" "}
                    {r.clock_out
                      ? <><b>{clock(r.clock_out)}</b> {r.out_dist_m != null && <span className="muted small">({meters(r.out_dist_m)})</span>}</>
                      : date < today ? <span className="flag bad">lupa clock out</span> : <span className="flag warn">masih bekerja</span>}
                  </p>
                  {(r.in_photo || r.out_photo) && (
                    <div className="row">{selfie(r.in_photo, `masuk ${clock(r.clock_in)}`)}{selfie(r.out_photo, `keluar ${clock(r.clock_out)}`)}</div>
                  )}
                  {r.koreksi && <p className="muted small">{r.koreksi}</p>}
                  <details>
                    <summary className="muted small">Ubah</summary>
                    <form action={fixClockOut} className="row" style={{ marginTop: 8 }}>
                      <input type="hidden" name="date" value={date} />
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="work_date" value={r.work_date} />
                      <label className="f">Jam keluar
                        <input name="time" inputMode="decimal" placeholder="22.30" defaultValue={clock(r.clock_out)} size={6} />
                      </label>
                      <button className="btn small">Simpan</button>
                    </form>
                    <form action={deleteAttendance} style={{ marginTop: 8 }}>
                      <input type="hidden" name="date" value={date} />
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn small danger">Hapus absen ini</button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="ck-section">
        <h3>{monthName(date)} sampai {dateLabel(date)}</h3>
        {month.length === 0 ? <p className="muted">Belum ada absensi bulan ini.</p> : (
          <div className="tbl">
            <table>
              <thead><tr><th>Staff</th><th>Hari masuk</th><th>Total jam</th><th>Lupa clock out</th></tr></thead>
              <tbody>
                {month.map((m) => (
                  <tr key={m.username}>
                    <td>{m.username}</td>
                    <td className="n">{m.days}</td>
                    <td className="n">{durationLabel(m.minutes)}</td>
                    <td className="n">{m.open || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">Total jam hanya menghitung absen yang sudah clock out.</p>
      </section>

      <section className="panel" id="lokasi">
        <p className="eyebrow">Lokasi Rasi Aksara</p>
        {place ? (
          <p>
            <a href={`https://www.google.com/maps?q=${place.lat},${place.lng}`} target="_blank" rel="noreferrer">
              {Number(place.lat).toFixed(6)}, {Number(place.lng).toFixed(6)}
            </a>{" "}
            · radius <b>{place.radius_m} m</b>
            {place.updated_by_name && <span className="muted small"> · diatur {place.updated_by_name}</span>}
          </p>
        ) : <p className="error">Belum diatur. Staff belum bisa clock in.</p>}
        <form action={saveLocation} className="formgrid" style={{ marginTop: 10 }}>
          <input type="hidden" name="date" value={date} />
          <label className="f" style={{ gridColumn: "1 / -1" }}>Link Google Maps atau koordinat
            <input name="where" id="ab-where" placeholder="https://maps.app.goo.gl/… atau -6.2, 106.8" />
          </label>
          <label className="f">Radius (meter)
            <input name="radius" inputMode="numeric" defaultValue={place?.radius_m ?? 100} />
          </label>
          <div className="row" style={{ alignSelf: "end" }}>
            <HereButton target="ab-where" />
            <button className="btn primary">Simpan lokasi</button>
          </div>
        </form>
        <p className="help small">
          Paling tepat: berdiri di dalam kafe, tekan <b>Pakai lokasi HP ini</b>, lalu <b>Simpan lokasi</b>. Radius 100 m cukup
          untuk GPS di dalam ruangan; besarkan kalau staff di kafe masih ditolak.
        </p>
      </section>
    </>
  );
}
