import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayJakarta } from "@/lib/data";
import { dateLabel } from "@/lib/types";
import { accountLabel } from "@/lib/staff";
import { SHEETS, noteKey, sheetForTime, type Entry, type SheetId } from "@/lib/checklist";
import { ChecklistFlow, type Photo } from "./ChecklistFlow";
import { DatePick } from "./DatePick";

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

export default async function Checklist({ searchParams }: { searchParams: Promise<{ date?: string; lembar?: string }> }) {
  const params = await searchParams;
  const today = todayJakarta();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") && params.date! <= today ? params.date! : today;
  const isToday = date === today;
  const now = nowJakarta();
  const sheet: SheetId = SHEETS.some((s) => s.id === params.lembar)
    ? (params.lembar as SheetId)
    : isToday ? sheetForTime(now.hour, now.minute) : "opening";

  const supabase = await createClient();
  const [{ data: rows, error }, { data: prev }, { data: { session } }] = await Promise.all([
    supabase.from("checklist_entries").select("key, done, done_by, done_at, value").eq("check_date", date),
    // The last closing note before this day, for the opening shift to read.
    supabase.from("checklist_entries").select("check_date, value")
      .eq("key", noteKey("closing")).lt("check_date", date).neq("value", "")
      .order("check_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.auth.getSession(),
  ]);

  if (error) {
    return (
      <div className="start">
        <h2 className="big">Checklist belum siap</h2>
        <p className="help">
          Tabel checklist belum ada di database. Jalankan file <code>0009_checklist.sql</code> di Supabase (SQL Editor), lalu buka
          halaman ini lagi.
        </p>
        <p className="muted small">{error.message}</p>
      </div>
    );
  }

  const entries: Record<string, Entry> = Object.fromEntries(
    (rows ?? []).map((r) => [r.key as string, { done: r.done, done_by: r.done_by, done_at: r.done_at, value: r.value } as Entry]),
  );
  const next = shiftDay(date, 1);

  // Photo proof for this day, with short-lived links to the private files.
  const { data: photoRows } = await supabase.from("checklist_photos")
    .select("id, key, path, taken_by, taken_at").eq("check_date", date).order("taken_at");
  const signed = photoRows?.length
    ? (await supabase.storage.from("checklist-photos").createSignedUrls(photoRows.map((p) => p.path as string), 60 * 60 * 12)).data
    : [];
  const urlOf = new Map((signed ?? []).map((u) => [u.path, u.signedUrl]));
  const photos: Record<string, Photo[]> = {};
  for (const p of photoRows ?? []) {
    (photos[p.key as string] ??= []).push({ ...(p as Omit<Photo, "url">), url: urlOf.get(p.path as string) ?? null });
  }

  return (
    <>
      <div className="daynav">
        <Link className="btn small" href={`/checklist?date=${shiftDay(date, -1)}&lembar=${sheet}`} aria-label="Hari sebelumnya">‹</Link>
        <div>
          <p className="eyebrow">Checklist shift</p>
          <h2 className="big">{isToday ? "Hari ini" : dateLabel(date)}</h2>
          {isToday && <p className="muted">{dateLabel(date)}</p>}
          <DatePick date={date} today={today} />
        </div>
        {next <= today
          ? <Link className="btn small" href={`/checklist?date=${next}&lembar=${sheet}`} aria-label="Hari berikutnya">›</Link>
          : <span />}
      </div>
      <ChecklistFlow
        key={date}
        date={date}
        initialSheet={sheet}
        hourNow={isToday ? now.hour : 24}
        me={accountLabel(session?.user.email)}
        initialEntries={entries}
        initialPhotos={photos}
        readOnly={!isToday}
        prevClosing={prev ? { dateText: dateLabel(prev.check_date as string), text: prev.value as string } : null}
      />
    </>
  );
}
