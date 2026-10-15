import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayJakarta } from "@/lib/data";
import { dateLabel } from "@/lib/types";
import { accountLabel } from "@/lib/staff";
import { SHIFTS, shiftForTime, type Report, type ShiftId } from "@/lib/laporan";
import { DatePick } from "../checklist/DatePick";
import { ReportForm } from "./ReportForm";

const shiftDay = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function nowJakarta() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour"), minute: get("minute") };
}

export default async function Laporan({ searchParams }: { searchParams: Promise<{ date?: string; shift?: string }> }) {
  const params = await searchParams;
  const today = todayJakarta();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") && params.date! <= today ? params.date! : today;
  const isToday = date === today;

  const supabase = await createClient();
  const [{ data: rows, error }, { data: { session } }] = await Promise.all([
    supabase.from("daily_reports").select("*").eq("report_date", date),
    supabase.auth.getSession(),
  ]);

  if (error) {
    return (
      <div className="start">
        <h2 className="big">Laporan harian belum siap</h2>
        <p className="help">
          Tabel laporan belum ada di database. Jalankan file <code>0010_laporan_harian.sql</code> di Supabase (SQL Editor), lalu buka
          halaman ini lagi.
        </p>
        <p className="muted small">{error.message}</p>
      </div>
    );
  }

  const reports = Object.fromEntries((rows ?? []).map((r) => [r.shift as string, r as Report])) as Partial<Record<ShiftId, Report>>;
  const now = nowJakarta();
  const shift: ShiftId = SHIFTS.some((s) => s.id === params.shift)
    ? (params.shift as ShiftId)
    : reports["12"] && !reports["1"] && !reports["2"] ? "12"
    : isToday ? shiftForTime(now.hour, now.minute)
    : reports["2"] && !reports["1"] ? "2" : "1";
  const next = shiftDay(date, 1);

  return (
    <>
      <div className="daynav">
        <Link className="btn small" href={`/laporan?date=${shiftDay(date, -1)}`} aria-label="Hari sebelumnya">‹</Link>
        <div>
          <p className="eyebrow">Laporan harian</p>
          <h2 className="big">{isToday ? "Hari ini" : dateLabel(date)}</h2>
          {isToday && <p className="muted">{dateLabel(date)}</p>}
          <DatePick date={date} today={today} path="/laporan" />
        </div>
        {next <= today
          ? <Link className="btn small" href={`/laporan?date=${next}`} aria-label="Hari berikutnya">›</Link>
          : <span />}
      </div>
      <p className="lp-links"><Link className="linkbtn" href="/laporan/riwayat">Lihat semua laporan →</Link></p>
      <ReportForm
        key={date}
        date={date}
        initialShift={shift}
        initialReports={reports}
        me={accountLabel(session?.user.email)}
        // Today and yesterday stay open (shift 2 can finish after midnight); older days are history.
        readOnly={date < shiftDay(today, -1)}
      />
    </>
  );
}
