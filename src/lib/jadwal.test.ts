import { describe, expect, it } from "vitest";
import { addDays, matchAccount, monthFromCell, parseCell, parseSchedule, weekStart } from "./jadwal";

const header = ["NO", "NAMA", "MINGGU/1", "SENIN/2", "SELASA/3"];

describe("parseSchedule", () => {
  it("reads the month from the Excel date and shifts by column position", () => {
    const rows = [[], ["46327"], header, ["1", "RAFI", "PAGI", "LIBUR", "MALAM"], ["2", "CHANDRA", "malam", "pagi", ""], ["", "", ""]];
    const p = parseSchedule(rows);
    expect(p.month).toBe("2026-11");
    expect(p.people).toEqual([
      { name: "RAFI", shifts: ["pagi", "libur", "malam"] },
      { name: "CHANDRA", shifts: ["malam", "pagi", null] },
    ]);
    expect(p.warnings.join(" ")).toContain("tanggal 1–3");
  });

  it("flags headers whose number is wrong but keeps reading by position", () => {
    const rows = [["46327"], ["NO", "NAMA", "MINGGU/1", "SENIN/9"], ["1", "A", "PAGI", "PAGI"]];
    const p = parseSchedule(rows);
    expect(p.people[0].shifts).toEqual(["pagi", "pagi"]);
    expect(p.warnings.join(" ")).toContain('kolom ke-2 tertulis "SENIN/9"');
  });

  it("uses the chosen month when the file has none, and drops extra columns", () => {
    const cols = Array.from({ length: 31 }, (_, i) => `H${i + 1}`);
    const p = parseSchedule([["NO", "NAMA", ...cols], ["1", "A", ...cols.map(() => "P")]], "2026-11");
    expect(p.month).toBe("2026-11");
    expect(p.days).toBe(30);
    expect(p.people[0].shifts).toHaveLength(30);
  });

  it("refuses a sheet without NAMA", () => {
    expect(() => parseSchedule([["a", "b"]])).toThrow(/NAMA/);
  });
});

describe("cells and dates", () => {
  it("knows the shift words", () => {
    expect(parseCell(" Pagi ")).toBe("pagi");
    expect(parseCell("SIANG")).toBe("malam");
    expect(parseCell("off")).toBe("libur");
    expect(parseCell("")).toBe(null);
    expect(parseCell("izin?")).toBe("?");
  });
  it("reads months", () => {
    expect(monthFromCell("2026-11-01")).toBe("2026-11");
    expect(monthFromCell("November 2026")).toBe("2026-11");
    expect(monthFromCell("12/2026")).toBe("2026-12");
    expect(monthFromCell("RAFI")).toBe(null);
  });
  it("finds Monday", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-15")).toBe("2026-11-09");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});

describe("matchAccount", () => {
  const accounts = [{ username: "rafi", name: "" }, { username: "rifky", name: "" }, { username: "vio", name: "Viona Putri" }];
  it("matches exactly, by name, and near", () => {
    expect(matchAccount("RAFI", accounts)).toEqual({ username: "rafi", sure: true });
    expect(matchAccount("VIONA", accounts)).toEqual({ username: "vio", sure: true });
    expect(matchAccount("RIFKI", accounts)).toEqual({ username: "rifky", sure: false });
    expect(matchAccount("KEVIN", accounts)).toBe(null);
  });
});

import { checkAttendance } from "./jadwal";
describe("checkAttendance", () => {
  const sched = [
    { work_date: "2026-11-16", name: "RAFI", username: "rafi", shift: "pagi" as const },
    { work_date: "2026-11-16", name: "KEVIN", username: "kevin", shift: "malam" as const },
    { work_date: "2026-11-16", name: "BRYAN", username: "bryan", shift: "libur" as const },
    { work_date: "2026-11-16", name: "PUTRI", username: null, shift: "pagi" as const },
    { work_date: "2026-11-16", name: "VIONA", username: "viona", shift: "pagi" as const },
  ];
  it("marks each person", () => {
    const att = [{ username: "rafi", shift: "pagi", clock_in: "x" }, { username: "bryan", shift: "malam", clock_in: "y" }];
    const out = checkAttendance(sched, att, "2026-11-16", "2026-11-16", "10:00").map((c) => c.status);
    expect(out).toEqual(["ok", "not-yet", "off-but-in", "unlinked", "absent"]);
  });
});
