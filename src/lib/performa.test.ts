import { describe, expect, it } from "vitest";
import { HOURS, SHEETS, hourlyKey, tickKeys } from "./checklist";
import { itemInfo, minutesInto, periodRange, summarize, type Row } from "./performa";

const at = (date: string, time: string) => new Date(`${date}T${time}:00+07:00`).toISOString();
const tick = (date: string, key: string, by: string, time: string): Row =>
  ({ check_date: date, key, done: true, done_by: by, done_at: at(date, time) });
const ROUND = ["lantai-in", "lantai-out", "mushola", "tissue", "parkir", "sampah"];
const round = (date: string, hour: number, by: string, time: string) => ROUND.map((i) => tick(date, hourlyKey(hour, i), by, time));

describe("periodRange", () => {
  it("covers a day, a Monday–Sunday week and a calendar month", () => {
    expect(periodRange("hari", "2026-10-18")).toEqual({ from: "2026-10-18", to: "2026-10-18", prev: "2026-10-17", next: "2026-10-19" });
    // 18 Oct 2026 is a Sunday.
    expect(periodRange("minggu", "2026-10-18")).toMatchObject({ from: "2026-10-12", to: "2026-10-18", prev: "2026-10-05", next: "2026-10-19" });
    expect(periodRange("bulan", "2026-10-18")).toMatchObject({ from: "2026-10-01", to: "2026-10-31", prev: "2026-09-01", next: "2026-11-01" });
    expect(periodRange("bulan", "2026-12-05")).toMatchObject({ to: "2026-12-31", next: "2027-01-01" });
  });
});

describe("itemInfo", () => {
  it("gives a due time 30 minutes after the printed time, the hour's end for hourly, the shift's end otherwise", () => {
    expect(itemInfo("opening:pintu")?.due).toBe(7 * 60 + 35);
    expect(itemInfo(hourlyKey(10, "parkir"))?.due).toBe(11 * 60);
    expect(itemInfo("handover:kas")?.due).toBe(14 * 60 + 30);
    expect(itemInfo("closing:catatan")).toBeUndefined();
  });
  it("reads tick times in WIB", () => {
    expect(minutesInto("2026-10-18", at("2026-10-18", "07:05"))).toBe(425);
  });
});

describe("summarize", () => {
  const day = "2026-10-17";
  const opts = { from: day, to: day, today: "2026-10-18", hourNow: 12 };

  it("counts ticks and late ticks per staff", () => {
    const s = summarize([tick(day, "opening:pintu", "rifky", "07:10"), tick(day, "opening:tanaman", "rifky", "07:50")], opts);
    expect(s.staff).toMatchObject([{ name: "rifky", ticks: 2, late: 1 }]);
    expect(s.ticks).toBe(2);
  });

  it("blames a missed round on whoever was on that shift", () => {
    const rows = [
      tick(day, "opening:pintu", "rifky", "07:05"),          // morning shift
      ...HOURS.filter((h) => h !== 10 && h < 14).flatMap((h) => round(day, h, "rifky", `${String(h).padStart(2, "0")}:15`)),
      tick(day, "handover:tanaman", "dina", "14:05"),        // evening shift
      ...HOURS.filter((h) => h >= 14 && h !== 20).flatMap((h) => round(day, h, "dina", `${h}:20`)),
      ...round(day, 20, "dina", "20:30").slice(0, 3),         // half a round
      tick(day, "closing:lampu", "dina", "22:20"),
    ];
    const s = summarize(rows, opts);
    expect(s.missed.map((r) => [r.hour, r.onDuty])).toEqual([[10, ["rifky"]]]);
    expect(s.partial.map((r) => [r.hour, r.onDuty])).toEqual([[20, ["dina"]]]);
    const rifky = s.staff.find((x) => x.name === "rifky")!;
    const dina = s.staff.find((x) => x.name === "dina")!;
    expect([rifky.missed, rifky.partial, rifky.rounds]).toEqual([1, 0, 4]);
    expect([dina.missed, dina.partial, dina.rounds]).toEqual([0, 1, 8]);
    expect(s.roundsJudged).toBe(13);
    expect(s.roundsFull).toBe(11);
  });

  it("only judges today's rounds whose hour is over, and skips days nobody used", () => {
    const today = "2026-10-18";
    const s = summarize([tick(today, "opening:pintu", "rifky", "07:05")], { from: "2026-10-16", to: today, today, hourNow: 12 });
    expect(s.activeDays).toEqual([today]);
    expect(s.missed.map((r) => r.hour)).toEqual([9, 10, 11]);
    expect(s.skipped).toBe(0);
  });

  it("shows who leaves the shared checklist to their shift mates", () => {
    const rows = [
      ...["pintu", "tanaman", "pel-indoor", "pel-teras", "mushola", "kamar-mandi"].map((i) => tick(day, `opening:${i}`, "rifky", "07:10")),
      ...["rak-buku", "meja-kursi"].map((i) => tick(day, `opening:${i}`, "budi", "07:20")),
      tick(day, "closing:lampu", "dina", "22:20"),
    ];
    const s = summarize(rows, opts);
    const budi = s.staff.find((x) => x.name === "budi")!;
    // Points, not ticks: Rifky's six included four heavy cleaning jobs (3 points each).
    expect(budi.share).toEqual({ own: 4, total: 18, fair: 9, peers: ["rifky"] });
    expect(budi.points).toBe(4);
    expect(s.staff.find((x) => x.name === "dina")!.share).toEqual({ own: 1, total: 1, fair: 1, peers: [] });
  });

  it("passes a shift only when its whole checklist and every hourly round is ticked", () => {
    const opening = SHEETS.find((x) => x.id === "opening")!;
    const all = tickKeys(opening).map((k) => tick(day, k, "rifky", "07:20"));
    const rounds = HOURS.filter((h) => h < 14).flatMap((h) => round(day, h, "rifky", `${String(h).padStart(2, "0")}:10`));
    const full = summarize([...all, ...rounds], opts);
    expect(full.shifts).toEqual([expect.objectContaining({ morning: true, passed: true, missedRounds: [], open: [], people: ["rifky"] })]);
    expect(full.staff[0]).toMatchObject({ shiftsJudged: 1, shiftsPassed: 1 });

    const short = summarize([...all.slice(1), ...rounds.slice(6)], opts);
    expect(short.shifts[0]).toMatchObject({ passed: false, missedRounds: [9], open: ["Opening · Buka pintu dan ventilasi ruangan"] });
    expect(short.staff[0]).toMatchObject({ shiftsJudged: 1, shiftsPassed: 0 });

    // Today's morning shift isn't judged until it's over.
    const today = summarize([...all, ...rounds].map((r) => ({ ...r, check_date: "2026-10-18", done_at: r.done_at!.replace("2026-10-17", "2026-10-18") })),
      { from: "2026-10-18", to: "2026-10-18", today: "2026-10-18", hourNow: 12 });
    expect(today.shifts[0].passed).toBeNull();
  });
});
