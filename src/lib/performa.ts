// Checklist performance per staff for the owner's dashboard (/performa, Zaky 18 Okt 2026).
// Everything is worked out from checklist_entries: who ticked (done_by) and when (done_at).

import { HOURS, SHEETS, hourlyKey, itemKey, type SheetId } from "./checklist";

export type Period = "hari" | "minggu" | "bulan";
export const PERIODS: { id: Period; label: string }[] = [
  { id: "hari", label: "Hari" },
  { id: "minggu", label: "Minggu" },
  { id: "bulan", label: "Bulan" },
];

/** Scoring starts on this day: the rules (points, deadlines) were announced to staff for 19 Okt 2026 (Zaky). */
export const COUNT_FROM = "2026-10-19";

/** A tick counts as late this many minutes after the time printed on the checklist. */
export const LATE_AFTER_MIN = 30;
/** When a sheet's untimed items are due: the end of that shift's window. */
const SHEET_END: Record<SheetId, number> = { opening: 8 * 60, operasional: 22 * 60, handover: 14 * 60 + 30, closing: 22 * 60 + 30 };
/** Guessing who was on shift: a first tick before noon means the morning shift, a tick from 15.00 the evening shift. */
const MORNING_ROUNDS = HOURS.filter((h) => h <= 14);
const EVENING_ROUNDS = HOURS.filter((h) => h >= 14);

const addDays = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The days a period covers around `anchor`: that day, its Monday–Sunday week, or its calendar month. */
export function periodRange(period: Period, anchor: string) {
  if (period === "hari") return { from: anchor, to: anchor, prev: addDays(anchor, -1), next: addDays(anchor, 1) };
  if (period === "minggu") {
    const dow = (new Date(anchor + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
    const from = addDays(anchor, -dow);
    return { from, to: addDays(from, 6), prev: addDays(from, -7), next: addDays(from, 7) };
  }
  const from = anchor.slice(0, 8) + "01";
  const d = new Date(from + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  const next = d.toISOString().slice(0, 10);
  d.setUTCMonth(d.getUTCMonth() - 2);
  return { from, to: addDays(next, -1), prev: d.toISOString().slice(0, 10), next };
}

const DAY = new Map<string, number>();
/** Minutes after midnight (WIB) of `date` at which `iso` happened. */
export function minutesInto(date: string, iso: string): number {
  let start = DAY.get(date);
  if (start == null) DAY.set(date, (start = Date.parse(date + "T00:00:00+07:00")));
  return Math.floor((Date.parse(iso) - start) / 60000);
}

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}.${String(min % 60).padStart(2, "0")}`;

type ItemInfo = { label: string; due: number; hour?: number; points: number };
const INFO = new Map<string, ItemInfo>();
for (const sheet of SHEETS) {
  for (const s of sheet.sections) {
    if (s.kind === "reminder") continue;
    for (const i of s.items) {
      if (s.kind === "hourly") {
        for (const h of HOURS) {
          INFO.set(hourlyKey(h, i.key), { label: `Hourly ${String(h).padStart(2, "0")}.00 · ${i.text}`, due: (h + 1) * 60, hour: h, points: i.points ?? 1 });
        }
        continue;
      }
      const m = /^(\d{2})\.(\d{2})$/.exec(i.time ?? "");
      const due = m ? Number(m[1]) * 60 + Number(m[2]) + LATE_AFTER_MIN : SHEET_END[sheet.id];
      INFO.set(itemKey(sheet.id, i.key), { label: `${sheet.title} · ${i.text}`, due, points: i.points ?? 1 });
    }
  }
}
/** What a checklist key is called and when it is due; undefined for notes and keys no longer on the list. */
export const itemInfo = (key: string) => INFO.get(key);
/** Tickable once-a-day items (not hourly), for counting what nobody ticked. */
const DAILY_KEYS = [...INFO.entries()].filter(([, v]) => v.hour == null).map(([k]) => k);

export type Row = { check_date: string; key: string; done: boolean; done_by: string | null; done_at: string | null };

export type Tick = { date: string; key: string; label: string; at: number; due: number; late: boolean; points: number };

export type StaffStat = {
  name: string;
  ticks: number;
  /** Ticks weighted by effort (CheckItem.points). */
  points: number;
  late: number;
  /** Hourly rounds they ticked at least one item of. */
  rounds: number;
  /** Rounds nobody touched / left half done while this person was on shift. */
  missed: number;
  partial: number;
  days: string[];
  list: Tick[];
  /** Their points, all points, and a fair split of all points, over the shifts they worked (see `summarize`). */
  share: { own: number; total: number; fair: number; peers: string[] };
};

export type Round = { date: string; hour: number; done: number; total: number; onDuty: string[] };

export type Summary = {
  ticks: number;
  late: number;
  roundsJudged: number;
  roundsFull: number;
  partial: Round[];
  missed: Round[];
  /** Once-a-day items (opening, handover, closing) nobody ticked on finished days. */
  skipped: number;
  activeDays: string[];
  staff: StaffStat[];
};

/**
 * Sums up ticks per staff between `from` and `to`. Hourly rounds are judged once their hour is over:
 * for past days all of 09–21, for today only the hours before `hourNow`. Days with no tick at all
 * are left out (the café was closed or the app not used yet), so they don't count as missed.
 */
export function summarize(rows: Row[], opts: { from: string; to: string; today: string; hourNow: number }): Summary {
  const roundItems = SHEETS.find((s) => s.id === "operasional")!.sections.find((s) => s.kind === "hourly")!.items;
  const staff = new Map<string, StaffStat>();
  const stat = (name: string) => {
    let s = staff.get(name);
    if (!s) staff.set(name, (s = { name, ticks: 0, points: 0, late: 0, rounds: 0, missed: 0, partial: 0, days: [], list: [], share: { own: 0, total: 0, fair: 0, peers: [] } }));
    return s;
  };
  const byDate = new Map<string, Map<string, Row>>();
  for (const r of rows) {
    if (r.check_date < opts.from || r.check_date > opts.to) continue;
    if (!byDate.has(r.check_date)) byDate.set(r.check_date, new Map());
    byDate.get(r.check_date)!.set(r.key, r);
  }

  const sum: Summary = { ticks: 0, late: 0, roundsJudged: 0, roundsFull: 0, partial: [], missed: [], skipped: 0, activeDays: [], staff: [] };
  for (const date of datesBetween(opts.from, opts.to)) {
    const day = byDate.get(date);
    const done = [...(day?.values() ?? [])].filter((r) => r.done && r.done_at && itemInfo(r.key));
    if (!done.length) continue;
    sum.activeDays.push(date);

    // Ticks, and each person's first and last tick of the day.
    const span = new Map<string, { first: number; last: number }>();
    for (const r of done) {
      const info = itemInfo(r.key)!;
      const at = minutesInto(date, r.done_at!);
      const name = r.done_by || "?";
      const s = stat(name);
      const late = at > info.due;
      s.ticks++;
      s.points += info.points;
      if (late) s.late++;
      s.list.push({ date, key: r.key, label: info.label, at, due: info.due, late, points: info.points });
      if (s.days[s.days.length - 1] !== date) s.days.push(date);
      sum.ticks++;
      if (late) sum.late++;
      const sp = span.get(name);
      span.set(name, sp ? { first: Math.min(sp.first, at), last: Math.max(sp.last, at) } : { first: at, last: at });
    }
    const onDuty = (hour: number) =>
      [...span.entries()].filter(([, { first, last }]) =>
        (first <= (hour + 1) * 60 && last >= hour * 60)
        || (first < 12 * 60 && MORNING_ROUNDS.includes(hour))
        || (last >= 15 * 60 && EVENING_ROUNDS.includes(hour)),
      ).map(([name]) => name);

    // Everyone on a shift shares one checklist, so someone can leave it to the others (Zaky, 18 Okt 2026).
    // Split the day at 14.00 into the morning and evening shift and compare each person's points (ticks
    // weighted by effort) with an even split among the people on that shift. Handover items are done by both shifts, so they're left out.
    for (const morning of [true, false]) {
      // On a shift = the shift guess above; someone fitting neither belongs where most of their ticks are.
      // A stray late tick across 14.00 doesn't make someone a member of the other shift.
      const half = (r: Row) => minutesInto(date, r.done_at!) < 14 * 60;
      const members = [...span.entries()].filter(([name, { first, last }]) => {
        if (first < 12 * 60 || last >= 15 * 60) return morning ? first < 12 * 60 : last >= 15 * 60;
        const mine = done.filter((r) => (r.done_by || "?") === name);
        return (mine.filter(half).length * 2 >= mine.length) === morning;
      }).map(([name]) => name);
      const inShift = done.filter((r) => !r.key.startsWith("handover:") && half(r) === morning && members.includes(r.done_by || "?"));
      if (!inShift.length || !members.length) continue;
      const pts = (list: Row[]) => list.reduce((n, r) => n + itemInfo(r.key)!.points, 0);
      const total = pts(inShift);
      for (const name of members) {
        const sh = stat(name).share;
        sh.own += pts(inShift.filter((r) => (r.done_by || "?") === name));
        sh.total += total;
        sh.fair += total / members.length;
        for (const peer of members) if (peer !== name && !sh.peers.includes(peer)) sh.peers.push(peer);
      }
    }

    // Hourly rounds.
    const isToday = date === opts.today;
    for (const hour of HOURS) {
      const keys = roundItems.map((i) => hourlyKey(hour, i.key));
      const by = new Set(keys.map((k) => day?.get(k)).filter((r) => r?.done).map((r) => r!.done_by || "?"));
      for (const name of by) stat(name).rounds++;
      if (isToday && hour >= opts.hourNow) continue;
      sum.roundsJudged++;
      const n = keys.filter((k) => day?.get(k)?.done).length;
      if (n === keys.length) { sum.roundsFull++; continue; }
      const round: Round = { date, hour, done: n, total: keys.length, onDuty: onDuty(hour) };
      (n === 0 ? sum.missed : sum.partial).push(round);
      for (const name of round.onDuty) stat(name)[n === 0 ? "missed" : "partial"]++;
    }

    if (date < opts.today) sum.skipped += DAILY_KEYS.filter((k) => !day?.get(k)?.done).length;
  }
  for (const s of staff.values()) s.list.sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
  sum.staff = [...staff.values()].sort((a, b) => b.ticks - a.ticks || a.name.localeCompare(b.name));
  return sum;
}

export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
