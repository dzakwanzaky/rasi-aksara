import { describe, expect, it } from "vitest";
import { calcLine, parseQty, type QtyItem } from "./qty";

const item = (unit: string, extra: Partial<QtyItem> = {}): QtyItem => ({
  unit, pack_size: null, pack_unit: "gr", min_stock: null, ...extra,
});

describe("parseQty", () => {
  it.each([
    ["3, 3/4", item("botol"), 3.75],
    ["3 1/2 pack", item("pack"), 3.5],
    ["3/4 pacs", item("pack"), 0.75],
    ["923 gr", item("gr"), 923],
    ["6kg", item("gr"), 6000],
    ["2,3kg", item("kg"), 2.3],
    ["4,000gr", item("gr"), 4000],
    ["100ml", item("ml"), 100],
    ["5, 329 gr", item("pack", { pack_size: 1000 }), 5.329],
    ["-", item("botol"), 0],
    ["1/2 toples", item(""), 0.5],
  ])("reads %s", (raw, it_, expected) => {
    expect(parseQty(raw, it_)).toBe(expected);
  });

  it("returns null for blanks", () => {
    expect(parseQty("  ", item("pcs"))).toBeNull();
    expect(parseQty(null, item("pcs"))).toBeNull();
  });

  it("cannot read grams without a pack size", () => {
    expect(parseQty("5, 329 gr", item("pack"))).toBeNaN();
  });
});

describe("calcLine", () => {
  it("computes usage as awal + masuk - tersedia", () => {
    const r = calcLine({ awal: "3, 3/4", masuk: "2", tersedia: "4" }, item("botol"));
    expect(r.keluar).toBe(1.75);
    expect(r.flags).toEqual([]);
  });

  it("flags a count higher than awal + masuk", () => {
    const r = calcLine({ awal: "923 gr", tersedia: "7952 gr" }, item("gr"));
    expect(r.flags.map((f) => f.label)).toContain("lebih dari awal+masuk");
  });

  it("flags items below minimum and empty items", () => {
    expect(calcLine({ tersedia: "1" }, item("botol", { min_stock: 2 })).flags[0].label).toBe("di bawah minimum");
    expect(calcLine({ tersedia: "2" }, item("botol", { min_stock: 2 })).flags[0].label).toBe("pas di minimum");
    expect(calcLine({ tersedia: "3" }, item("botol", { min_stock: 2 })).flags).toEqual([]);
    expect(calcLine({ tersedia: "0" }, item("botol")).flags[0].label).toBe("habis");
  });
});
