import { describe, expect, it } from "vitest";
import { hasil, omsetLain, readRupiah, rupiah, selisih, shiftForTime, totals } from "./laporan";

// Numbers from the LAPORAN HARIAN sheet.
const okt5 = { omset: 1673000, tunai_sistem: 697500, tf_sistem: 951000, tunai_aktual: 698000, pengeluaran: 60000, modal: 200000 };
const okt8 = { omset: 2286000, tunai_sistem: 458000, tf_sistem: 1674000, tunai_aktual: 618000, pengeluaran: 46000, modal: 200000 };

describe("laporan harian", () => {
  it("works out plus/minus and hasil like the sheet", () => {
    expect(selisih(okt5)).toBe(500);
    expect(selisih(okt8)).toBe(160000);
    expect(hasil(okt5)).toBe(498000);
    expect(selisih({ tunai_sistem: 100000, tunai_aktual: 90000 })).toBe(-10000);
    expect(selisih({ tunai_sistem: 100000 })).toBeNull();
  });
  it("shows sales outside tunai and TF", () => {
    expect(omsetLain(okt5)).toBe(24500);
    expect(omsetLain({ omset: 1 })).toBeNull();
  });
  it("reads rupiah as staff type it", () => {
    expect(readRupiah("1.673.000")).toBe(1673000);
    expect(readRupiah("Rp 1673000")).toBe(1673000);
    expect(readRupiah("697.500")).toBe(697500);
    expect(readRupiah("")).toBeNull();
    expect(readRupiah("abc")).toBeNaN();
  });
  it("picks the shift from the clock", () => {
    expect(shiftForTime(8, 0)).toBe("1");
    expect(shiftForTime(14, 29)).toBe("1");
    expect(shiftForTime(14, 30)).toBe("2");
  });
  it("adds up a month", () => {
    const t = totals([okt5, okt8, { tunai_sistem: 100, tunai_aktual: 50 }]);
    expect(t.omset).toBe(3959000);
    expect(t.plus).toBe(160500);
    expect(t.minus).toBe(-50);
    expect(rupiah(-1500)).toBe("−Rp 1.500");
  });
});
