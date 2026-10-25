import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayJakarta } from "@/lib/data";
import { dateLabel } from "@/lib/types";
import { isAdmin } from "@/lib/admin";
import { SHIFTS, clock, durationLabel, minutesWorked, shiftForHour, type AttendanceRow } from "@/lib/absen";
import { AbsenFlow } from "./AbsenFlow";

const hourJakarta = () =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(new Date()));

export default async function Absen() {
  const today = todayJakarta();
  const supabase = await createClient();
  const [{ data: { user } }, admin, { data: rows, error }, { data: place }] = await Promise.all([
    supabase.auth.getUser(),
    isAdmin(supabase),
    supabase.from("attendance").select("id, user_id, username, work_date, shift, clock_in, clock_out, in_dist_m, out_dist_m, koreksi")
      .eq("work_date", today).order("clock_in"),
    supabase.from("attendance_settings").select("lat, lng, radius_m").eq("id", 1).maybeSingle(),
  ]);

  if (error) {
    return (
      <div className="start">
        <h2 className="big">Absen belum siap</h2>
        <p className="help">
          Tabel absensi belum ada di database. Jalankan file <code>0015_absensi.sql</code> di Supabase (SQL Editor), lalu buka
          halaman ini lagi.
        </p>
        <p className="muted small">{error.message}</p>
      </div>
    );
  }

  const list = (rows ?? []) as (AttendanceRow & { user_id: string })[];
  const mine = list.filter((r) => r.user_id === user?.id);
  const open = mine.find((r) => !r.clock_out) ?? null;

  return (
    <>
      <div className="bar">
        <div>
          <p className="eyebrow">Absen</p>
          <h2 className="big">Hari ini</h2>
          <p className="muted">{dateLabel(today)}</p>
        </div>
        <span className="spacer" />
        {admin && <Link className="btn small" href="/absen/rekap">Rekap absensi</Link>}
      </div>

      <AbsenFlow
        place={place ? { lat: place.lat as number, lng: place.lng as number, radius: place.radius_m as number } : null}
        open={open ? { shift: open.shift, clockIn: clock(open.clock_in) } : null}
        doneToday={mine.filter((r) => r.clock_out).map((r) => `${clock(r.clock_in)}–${clock(r.clock_out)}`)}
        defaultShift={shiftForHour(hourJakarta())}
        admin={admin}
      />

      <section className="ck-section">
        <h3>Yang absen hari ini</h3>
        {list.length === 0 && <p className="muted">Belum ada yang clock in hari ini.</p>}
        {SHIFTS.map((s) => {
          const inShift = list.filter((r) => r.shift === s.id);
          if (!inShift.length) return null;
          return (
            <div key={s.id} className="panel ab-shift">
              <p className="eyebrow">{s.label} · {s.hours}</p>
              <ul className="ab-people">
                {inShift.map((r) => (
                  <li key={r.id}>
                    <b>{r.username}</b>
                    <span className="ab-times">
                      {clock(r.clock_in)} – {r.clock_out ? clock(r.clock_out) : <span className="flag warn">masih bekerja</span>}
                    </span>
                    {r.clock_out && <span className="muted small">{durationLabel(minutesWorked(r))}</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </>
  );
}
