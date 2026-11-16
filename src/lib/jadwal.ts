// Jadwal shift staff (Zaky, 16 Nov 2026). The admin uploads the monthly Excel as he already makes it
// (NO | NAMA | MINGGU/1 | SENIN/2 | … with PAGI / MALAM / LIBUR per day), checks the preview, and saves.
// Rows live in shift_schedule (migration 0018), one per person per day.

export type Jadwal = "pagi" | "malam" | "libur";

export const JADWAL: { id: Jadwal; label: string; short: string; hours: string }[] = [
  { id: "pagi", label: "Pagi", short: "P", hours: "07.00–15.00" },
  { id: "malam", label: "Malam", short: "M", hours: "14.30–22.30" },
  { id: "libur", label: "Libur", short: "L", hours: "" },
];

export const jadwalInfo = (s: string | null | undefined) => JADWAL.find((x) => x.id === s);

export type ScheduleRow = { work_date: string; name: string; username: string | null; shift: Jadwal };

/** What a cell says → a shift. Empty cells are null; anything unknown is "?" so the preview can flag it. */
export function parseCell(text: string): Jadwal | null | "?" {
  const t = text.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!t) return null;
  if (["pagi", "p", "shift1", "s1", "1"].includes(t)) return "pagi";
  if (["malam", "m", "siang", "sore", "shift2", "s2", "2"].includes(t)) return "malam";
  if (["libur", "l", "off", "cuti", "lbr"].includes(t)) return "libur";
  return "?";
}

const DAY_NAMES = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

export const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

export const monthDate = (month: string, day: number) => `${month}-${String(day).padStart(2, "0")}`;

/** 0 = Minggu … 6 = Sabtu. */
export const weekday = (date: string) => new Date(date + "T00:00:00Z").getUTCDay();

export const addDays = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** The Monday of the week a date is in. */
export const weekStart = (date: string) => addDays(date, -((weekday(date) + 6) % 7));

/** A month written above the table: an Excel date number (46327), "2026-11-01", "11/2026" or "November 2026". */
export function monthFromCell(text: string): string | null {
  const t = text.trim();
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const n = Math.floor(Number(t));
    if (n > 40000 && n < 60000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 7);
  }
  let m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = /^(?:\d{1,2}[/-])?(\d{1,2})[/-](\d{4})$/.exec(t);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${m[1].padStart(2, "0")}`;
  const names = ["jan", "feb", "mar", "apr", "mei|may", "jun", "jul", "agu|aug", "sep", "okt|oct", "nov", "des|dec"];
  m = /([a-z]+)\D*(\d{4})/i.exec(t);
  if (m) {
    const i = names.findIndex((n) => n.split("|").some((x) => m![1].toLowerCase().startsWith(x)));
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, "0")}`;
  }
  return null;
}

export type ParsedSchedule = {
  month: string | null;
  people: { name: string; shifts: (Jadwal | null)[] }[];
  days: number;
  warnings: string[];
};

const norm = (s: string) => s.trim().toLowerCase();

/** Reads the sheet. Day columns are taken by position (1st day column = tanggal 1), because the headers are
 * typed by hand and can be wrong; a header whose day name or number disagrees is reported as a warning. */
export function parseSchedule(rows: string[][], fallbackMonth?: string): ParsedSchedule {
  const h = rows.findIndex((r) => r.some((c) => norm(c) === "nama"));
  if (h < 0) throw new Error("Kolom NAMA tidak ditemukan. Pakai format: NO | NAMA | MINGGU/1 | SENIN/2 | …");
  const header = rows[h];
  const cName = header.findIndex((c) => norm(c) === "nama");
  let last = header.length - 1;
  while (last > cName && !header[last]?.trim()) last--;
  const dayCols = Array.from({ length: last - cName }, (_, i) => cName + 1 + i);

  let month: string | null = null;
  for (const r of rows.slice(0, h)) for (const c of r) month ??= c ? monthFromCell(c) : null;
  const warnings: string[] = [];
  if (!month) {
    month = fallbackMonth ?? null;
    if (month) warnings.push("Bulan tidak tertulis di file, jadi dipakai bulan yang dipilih.");
  }

  const days = month ? Math.min(dayCols.length, daysInMonth(month)) : dayCols.length;
  if (month && dayCols.length > days) warnings.push(`File punya ${dayCols.length} kolom hari, bulan ini hanya ${days} hari. Kolom sisanya diabaikan.`);
  if (month && dayCols.length < daysInMonth(month)) warnings.push(`File hanya berisi tanggal 1–${dayCols.length}. Sisanya belum dijadwalkan.`);

  if (month) {
    const wrong: string[] = [];
    for (let i = 0; i < days; i++) {
      const head = norm(header[dayCols[i]] ?? "").replace(/'/g, "");
      const date = monthDate(month, i + 1);
      const nameOk = !/[a-z]/.test(head) || head.startsWith(DAY_NAMES[weekday(date)]);
      const num = /(\d{1,2})\s*$/.exec(head)?.[1];
      if (!nameOk || (num && Number(num) !== i + 1)) wrong.push(`kolom ke-${i + 1} tertulis "${header[dayCols[i]]}"`);
    }
    if (wrong.length)
      warnings.push(`Judul kolom tidak cocok dengan tanggalnya (${wrong.join(", ")}). Dibaca menurut urutan kolom: kolom ke-1 = tanggal 1, dan seterusnya.`);
  }

  const people: ParsedSchedule["people"] = [];
  const unknown: string[] = [];
  for (const r of rows.slice(h + 1)) {
    const name = (r[cName] ?? "").trim();
    if (!name) continue;
    const shifts = dayCols.slice(0, days).map((c, i) => {
      const v = parseCell(r[c] ?? "");
      if (v === "?") { unknown.push(`${name} tgl ${i + 1}: "${r[c]}"`); return null; }
      return v;
    });
    if (shifts.every((s) => s == null)) continue;
    people.push({ name, shifts });
  }
  if (!people.length) throw new Error("Tidak ada baris staff dengan isi PAGI / MALAM / LIBUR.");
  if (unknown.length) warnings.push(`Isi sel tidak dikenal, dikosongkan: ${unknown.slice(0, 8).join("; ")}${unknown.length > 8 ? " …" : ""}`);
  return { month, people, days, warnings };
}

/** A staff login; `name` is the full formal name and `nick` the nickname (staff_profiles, 0019), when known. */
export type Account = { username: string; name: string; nick?: string };

const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** The staff account a name in the sheet belongs to. `sure` is false for a near match (RIFKI → rifky),
 * which the preview asks the admin to check. */
export function matchAccount(name: string, accounts: Account[]): { username: string; sure: boolean } | null {
  const n = letters(name);
  if (!n) return null;
  const keys = (a: Account) => [letters(a.username), letters(a.nick ?? ""), letters(a.name), ...a.name.split(/\s+/).map(letters)].filter(Boolean);
  const exact = accounts.filter((a) => keys(a).includes(n));
  if (exact.length === 1) return { username: exact[0].username, sure: true };
  if (exact.length > 1) return null;
  const near = accounts.filter((a) => keys(a).some((k) => (n.length >= 4 && editDistance(n, k) <= 1) || (n.length >= 3 && k.startsWith(n))));
  return near.length === 1 ? { username: near[0].username, sure: false } : null;
}

const SHORT_DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const LONG_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const dayShort = (date: string) => SHORT_DAYS[weekday(date)];
/** "Senin, 16 Nov" */
export const dayLong = (date: string) => `${LONG_DAYS[weekday(date)]}, ${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
export const monthLabel = (month: string) =>
  new Date(month + "-01T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });

/** "RAFI" → "Rafi", for showing names typed in capitals. */
export const displayName = (name: string) => name.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

export const SHIFT_START: Record<"pagi" | "malam", string> = { pagi: "07:00", malam: "14:30" };

export type SchedCheck = {
  name: string;
  username: string | null;
  shift: Jadwal;
  status: "ok" | "other-shift" | "absent" | "not-yet" | "unlinked" | "off-but-in" | "off";
  clockIn?: string;
};

/** Schedule next to who actually clocked in on one day. `nowHHMM` is the Jakarta time, for "belum mulai". */
export function checkAttendance(
  sched: ScheduleRow[], att: { username: string; shift: string; clock_in: string }[], date: string, today: string, nowHHMM: string,
): SchedCheck[] {
  return sched.map((r) => {
    const mine = r.username ? att.filter((a) => a.username === r.username) : [];
    const base = { name: r.name, username: r.username, shift: r.shift };
    if (r.shift === "libur") return { ...base, status: mine.length ? "off-but-in" : "off", clockIn: mine[0]?.clock_in };
    if (!r.username) return { ...base, status: "unlinked" };
    const same = mine.find((a) => a.shift === r.shift);
    if (same) return { ...base, status: "ok", clockIn: same.clock_in };
    if (mine.length) return { ...base, status: "other-shift", clockIn: mine[0].clock_in };
    const started = date < today || (date === today && nowHHMM >= SHIFT_START[r.shift]);
    return { ...base, status: started ? "absent" : "not-yet" };
  });
}
