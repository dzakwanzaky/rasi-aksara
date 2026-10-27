// Clock in / clock out (Zaky, 25 Okt 2026). The database (migration 0015) checks the distance again and sets the
// times; these helpers are for showing things on the phone and for the admin rekap.

export type Shift = "pagi" | "malam";

export const SHIFTS: { id: Shift; label: string; hours: string }[] = [
  { id: "pagi", label: "Shift pagi", hours: "07.00–14.30" },
  { id: "malam", label: "Shift malam", hours: "14.00–22.30" },
];

export const shiftLabel = (s: string) => SHIFTS.find((x) => x.id === s)?.label ?? s;

/** The shift someone clocking in at this Jakarta hour most likely works. */
export const shiftForHour = (hour: number): Shift => (hour < 12 ? "pagi" : "malam");

export type AttendanceRow = {
  id: number;
  username: string;
  work_date: string;
  shift: string;
  clock_in: string;
  clock_out: string | null;
  in_dist_m: number | null;
  out_dist_m: number | null;
  koreksi: string | null;
  in_photo?: string | null;
  out_photo?: string | null;
};

/** Metres between two points on the earth. */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

const valid = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Coordinates from a Google Maps link or from "lat, lng" typed by hand. A place link's pin (!3d…!4d…) wins over
 * the map's centre (@lat,lng). Short links (maps.app.goo.gl) must be opened first to get the long one. */
export function parseCoords(text: string): { lat: number; lng: number } | null {
  const t = decodeURIComponent(text.trim());
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const patterns = [
    new RegExp(`!3d${num}!4d${num}`),
    new RegExp(`[?&](?:q|query|ll|destination|center)=${num},\\s*${num}`),
    new RegExp(`@${num},${num}`),
    new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`),
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

export const clock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : "";

/** Minutes worked, or null while still clocked in. */
export const minutesWorked = (r: Pick<AttendanceRow, "clock_in" | "clock_out">) =>
  r.clock_out ? Math.max(0, Math.round((Date.parse(r.clock_out) - Date.parse(r.clock_in)) / 60000)) : null;

export const durationLabel = (min: number | null) =>
  min == null ? "" : `${Math.floor(min / 60)} j ${String(min % 60).padStart(2, "0")} m`;

export type StaffSummary = { username: string; days: number; minutes: number; open: number };

/** Per staff over a period: days worked, total time of finished clock-outs, and clock-ins never closed. */
export function summarize(rows: AttendanceRow[], today: string): StaffSummary[] {
  const by = new Map<string, { days: Set<string>; minutes: number; open: number }>();
  for (const r of rows) {
    const s = by.get(r.username) ?? { days: new Set<string>(), minutes: 0, open: 0 };
    s.days.add(r.work_date);
    const m = minutesWorked(r);
    if (m != null) s.minutes += m;
    else if (r.work_date < today) s.open += 1;
    by.set(r.username, s);
  }
  return [...by].map(([username, s]) => ({ username, days: s.days.size, minutes: s.minutes, open: s.open }))
    .sort((a, b) => b.minutes - a.minutes || a.username.localeCompare(b.username));
}

/** "HH:MM" (or "HH.MM") on a Jakarta date → ISO time, for an admin filling in a forgotten clock out. */
export function jakartaTime(date: string, hhmm: string): string | null {
  const m = hhmm.trim().match(/^(\d{1,2})[.:](\d{2})$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return new Date(`${date}T${m[1].padStart(2, "0")}:${m[2]}:00+07:00`).toISOString();
}

/** What to tell staff when the browser could not give a location. */
export function geoErrorText(code: number): string {
  if (code === 1)
    return "Izin lokasi ditolak. Buka pengaturan browser (ikon gembok/ⓘ di samping alamat web) → Izin → Lokasi → Izinkan, lalu coba lagi. Di iPhone: Pengaturan → Privasi → Layanan Lokasi → Situs Web Safari → Saat Digunakan.";
  if (code === 3) return "Lokasi terlalu lama terbaca. Pastikan GPS/Lokasi HP menyala, lalu coba lagi.";
  return "Lokasi HP tidak terbaca. Pastikan GPS/Lokasi HP menyala, lalu coba lagi.";
}
