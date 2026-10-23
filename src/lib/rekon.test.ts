import { describe, expect, it } from "vitest";
import { dayState, qrisCheck, tunaiCheck } from "./rekon";

// Majoo cash on 19 Okt 2026: shift 1 813.000, shift 2 984.000.
const CASH = new Map([["1", 813000], ["2", 984000]]);
const report = (shift: string, tunai_aktual: number | null, pengeluaran: number | null = null, modal: number | null = 200000) =>
  ({ shift, tunai_aktual, modal, pengeluaran });

describe("tunai", () => {
  it("checks each shift's drawer against that shift's Majoo cash plus modal minus spending", () => {
    const t = tunaiCheck(CASH, [report("1", 1003000, 10000), report("2", 1184000)]);
    expect(t.seharusnya).toBe(813000 + 200000 - 10000 + 984000 + 200000);
    expect(t.aktual).toBe(2187000);
    expect(t.selisih).toBe(0);
    expect(t.missing).toEqual([]);
  });
  it("uses a shift 1 & 2 report for the whole day", () => {
    const t = tunaiCheck(CASH, [report("12", 1990000)]);
    expect(t.seharusnya).toBe(1797000 + 200000);
    expect(t.selisih).toBe(-7000);
  });
  it("stays open while a shift with cash sales has no drawer count", () => {
    const t = tunaiCheck(CASH, [report("1", 1013000), report("2", null)]);
    expect(t.selisih).toBeNull();
    expect(t.missing).toEqual(["2"]);
    expect(tunaiCheck(CASH, []).missing).toEqual(["1", "2"]);
  });
  it("takes the default modal when a report leaves it blank", () => {
    expect(tunaiCheck(new Map([["1", 100000]]), [report("1", 300000, null, null)]).selisih).toBe(0);
  });
});

describe("QRIS", () => {
  it("compares the bank amount with Majoo QRIS minus the fee", () => {
    const q = qrisCheck(2691000, 2672163, 0.7);
    expect(q.bersih).toBe(2672163);
    expect(q.selisih).toBe(0);
  });
  it("compares with the gross amount while the fee is not set", () => {
    const q = qrisCheck(2691000, 2672163, null);
    expect(q.bersih).toBeNull();
    expect(q.feeKnown).toBe(false);
    expect(q.selisih).toBe(-18837);
  });
  it("stays open until the bank amount is typed", () => {
    expect(qrisCheck(2691000, null, 0.7).selisih).toBeNull();
  });
});

describe("day", () => {
  const ok = tunaiCheck(CASH, [report("12", 1997000)]);
  it("marks a day over the limit and leaves it unmarked without a limit", () => {
    const q = qrisCheck(100000, 50000, null);
    expect(dayState(ok, q, 20000)).toEqual({ state: "besar", total: -50000 });
    expect(dayState(ok, q, null)).toEqual({ state: "ok", total: -50000 });
  });
  it("is open while QRIS sales have no bank amount, and fine with no QRIS sales", () => {
    expect(dayState(ok, qrisCheck(100000, null, null), 20000).state).toBe("belum");
    expect(dayState(ok, qrisCheck(0, null, null), 20000)).toEqual({ state: "ok", total: 0 });
  });
});
