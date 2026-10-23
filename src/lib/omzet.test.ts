import { describe, expect, it } from "vitest";
import { methodOf, summarize, topMenus, weekStart, weeks, type TrxRow } from "./omzet";

const t = (shift: string, method: string, total: number, products: string[] = []): TrxRow => ({ trx_no: "x", shift, method, total, products });

describe("omzet", () => {
  it("sorts Majoo payment methods into tunai, QRIS and lainnya", () => {
    expect(methodOf("Cash")).toBe("tunai");
    expect(methodOf("Bank Transfer - Qris")).toBe("qris");
    expect(methodOf("Cash, Bank Transfer - Qris")).toBe("lain");
    expect(methodOf("Debit BCA")).toBe("lain");
    expect(methodOf("")).toBe("lain");
  });

  it("adds up a day per method and per shift", () => {
    const s = summarize([t("1", "Cash", 28000), t("1", "Bank Transfer - Qris", 26000), t("2", "Cash", 10000), t("2", "OVO", 5000)]);
    expect(s.count).toBe(4);
    expect(s.total).toBe(69000);
    expect(s.byMethod).toEqual({ tunai: 38000, qris: 26000, lain: 5000 });
    expect(s.countByMethod).toEqual({ tunai: 2, qris: 1, lain: 1 });
    expect(s.byShift.get("1")).toEqual({ tunai: 28000, qris: 26000, lain: 0, count: 2, total: 54000 });
    expect(s.byShift.get("2")!.total).toBe(15000);
    expect([...s.otherMethods]).toEqual([["OVO", 5000]]);
  });

  it("ranks menus by the transactions they appear in", () => {
    const top = topMenus([t("1", "Cash", 0, ["Rasi Nara", "Donat"]), t("1", "Cash", 0, ["Rasi Nara"]), t("1", "Cash", 0, ["Donat", "Donat"])]);
    expect(top).toEqual([{ menu: "Donat", count: 2 }, { menu: "Rasi Nara", count: 2 }]);
  });

  it("groups days into Monday–Sunday weeks", () => {
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
    const w = weeks([
      { sale_date: "2026-10-19", trx_count: 98, total: 4488000, tunai: 1797000, qris: 2691000, lain: 0 },
      { sale_date: "2026-10-20", trx_count: 10, total: 100000, tunai: null, qris: null, lain: null },
      { sale_date: "2026-10-26", trx_count: 5, total: 50000, tunai: 50000, qris: 0, lain: 0 },
    ]);
    expect(w.map((x) => [x.start, x.days, x.total, x.splitKnown])).toEqual([
      ["2026-10-26", 1, 50000, true],
      ["2026-10-19", 2, 4588000, false],
    ]);
  });
});
