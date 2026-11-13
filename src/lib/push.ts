// Round notifications (Zaky, 13 Nov 2026): the database pings /api/push/ronde at minute 0 and 30 of every hour.
// At minute 0 of a round hour, staff on shift get "waktunya ronde"; at minute 30 they get a reminder only if
// that round is not fully ticked yet. These helpers decide what to send; they touch no network.

import { SHEETS, hoursFor, hourlyKey } from "./checklist";

export type JakartaTime = { date: string; hour: number; minute: number };

export function jakartaTime(now: Date = new Date()): JakartaTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) };
}

/** The keys staff tick in one round (one per hourly item). */
export function roundKeys(hour: number): string[] {
  return SHEETS.flatMap((s) => s.sections).filter((s) => s.kind === "hourly").flatMap((s) => s.items.map((i) => hourlyKey(hour, i.key)));
}

export type RoundPing = { kind: "mulai" | "ingat"; hour: number; slot: string };

/** Which ping is due at this time, if any. A late cron run (up to 14 minutes) still counts for its slot. */
export function pingDue(t: JakartaTime): RoundPing | null {
  if (!hoursFor(t.date).includes(t.hour)) return null;
  const hh = String(t.hour).padStart(2, "0");
  if (t.minute < 15) return { kind: "mulai", hour: t.hour, slot: `${t.date}:${hh}:00` };
  if (t.minute >= 30 && t.minute < 45) return { kind: "ingat", hour: t.hour, slot: `${t.date}:${hh}:30` };
  return null;
}

export type PushMessage = { title: string; body: string; url: string; tag: string };

const jam = (hour: number) => `${String(hour).padStart(2, "0")}.00`;

export function roundMessage(ping: RoundPing, done = 0, total = roundKeys(ping.hour).length): PushMessage {
  const base = { url: "/checklist?lembar=operasional", tag: `ronde-${ping.hour}` };
  if (ping.kind === "mulai") {
    return { ...base, title: `Ronde jam ${jam(ping.hour)}`, body: "Waktunya cek keliling: lantai, mushola, tissue, parkir, sampah. Foto tiap poin di Checklist." };
  }
  return {
    ...base,
    title: `Ronde jam ${jam(ping.hour)} belum lengkap`,
    body: done === 0 ? "Belum ada yang dicentang. Yuk keliling sekarang." : `Baru ${done} dari ${total} poin. Lengkapi sekarang ya.`,
  };
}

export const testMessage = (username: string): PushMessage => ({
  title: "Notifikasi aktif",
  body: `Halo ${username}, HP ini akan dapat pengingat tiap ronde checklist.`,
  url: "/checklist",
  tag: "tes",
});
