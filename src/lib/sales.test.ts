import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { expectedUsage, inferQty, parseMajoo, readXlsxRows, saleDay, salesLines, verdict, type Trx } from "./sales";

// Menu prices from the Majoo export of 19 Okt 2026.
const PRICE: Record<string, number> = {
  "Teh tarik": 14000, "Rasi Nara": 18000, Platter: 19000, Donat: 10000, "Caffe Latte": 22000,
  "Ayam Geprek": 20000, "Mango Squash": 18000, "Strawberry Squash": 17000,
};
const price = (m: string) => PRICE[m];
const trx = (products: string[], total: number, shift: "1" | "2" = "1"): Trx => ({ no: "x", date: "2026-10-19", shift, products, total });

// Rows shaped like Majoo's "Detail Penjualan" sheet: a summary block, then the header on row 13.
const ROWS = [
  ["Detail Penjualan"],
  ["Periode", "19 Oktober 2026 00:00:00 - 19 Oktober 2026 23:59:59"],
  ["No Transaksi", "Waktu Order", "Waktu Bayar", "Outlet", "Produk", "Jenis Order", "Sisa Tagihan (Rp.)", "Total Penjualan (Rp)", "Metode Pembayaran", "Bayar", "Order"],
  ["CS/01/261019/0014", "19-10-2026 09:37:01", "", "Rasi Aksara", "Rasi Kartika,Rasi Nara", "Free Table", "0", "36000", "Cash", "shift 1", "shift 1"],
  ["CS/01/261019/0045", "19-10-2026 14:32:20", "", "Rasi Aksara", "Teh tarik", "Free Table", "0", "28000", "Cash", "shift 1", "shift 1"],
  ["CS/01/261020/0001", "20-10-2026 00:40:00", "", "Rasi Aksara", "Donat", "Free Table", "0", "10000", "Cash", "shift 2", "shift 2"],
  [],
  ["", "", "", "", "", "", "", "", "", "", "Powered By"],
];

describe("Majoo export", () => {
  it("reads the transactions under the header", () => {
    const t = parseMajoo(ROWS);
    expect(t).toHaveLength(3);
    expect(t[0]).toEqual({ no: "CS/01/261019/0014", date: "2026-10-19", shift: "1", products: ["Rasi Kartika", "Rasi Nara"], total: 36000 });
    expect(t[2].shift).toBe("2");
  });
  it("puts sales before 06:00 on the night before, like the stock count", () => {
    expect(saleDay("20-10-2026 00:40:00")).toBe("2026-10-19");
    expect(saleDay("20-10-2026 06:00:00")).toBe("2026-10-20");
    expect(saleDay("19-10-2026 08:09:26")).toBe("2026-10-19");
    expect(saleDay("bukan tanggal")).toBeNull();
  });
  it("refuses a file without the transaction table", () => {
    expect(() => parseMajoo([["Laporan Lain"]])).toThrow(/Detail Penjualan/);
  });
  it("reads cells straight out of the .xlsx", () => {
    const shared = `<sst><si><t>No Transaksi</t></si><si><t>Produk</t></si><si><t>Teh tarik,Donat</t></si></sst>`;
    const sheet = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" t="inlineStr"><is><t>CS/1 &amp; 2</t></is></c><c r="B2"/><c r="C2" t="s"><v>2</v></c><c r="D2"><v>24000</v></c></row>
    </sheetData></worksheet>`;
    const file = zipSync({ "xl/sharedStrings.xml": strToU8(shared), "xl/worksheets/sheet1.xml": strToU8(sheet) });
    expect(readXlsxRows(file)).toEqual([["No Transaksi", "", "Produk"], ["CS/1 & 2", "", "Teh tarik,Donat", "24000"]]);
  });
});

describe("portions from prices", () => {
  it("finds how many of each menu were in a transaction", () => {
    expect(inferQty(trx(["Teh tarik"], 28000), price)).toEqual({ qty: [2], exact: true });
    expect(inferQty(trx(["Rasi Nara", "Teh tarik"], 32000), price)).toEqual({ qty: [1, 1], exact: true });
    expect(inferQty(trx(["Caffe Latte"], 44000), price)).toEqual({ qty: [2], exact: true });
  });
  it("takes the smallest fit when two are possible, and says it is unsure", () => {
    // 19 Okt, CS/01/261019/0046: Rp148.000 fits 4 geprek + 1 of the rest, or 2 mango + 4 teh tarik.
    const r = inferQty(trx(["Ayam Geprek", "Platter", "Mango Squash", "Strawberry Squash", "Teh tarik"], 148000), price);
    expect(r.qty).toEqual([4, 1, 1, 1, 1]);
    expect(r.exact).toBe(false);
  });
  it("counts each menu once when a price is unknown or nothing fits", () => {
    expect(inferQty(trx(["Menu Baru", "Donat"], 30000), price)).toEqual({ qty: [1, 1], exact: false });
    expect(inferQty(trx(["Donat"], 15000), price)).toEqual({ qty: [1], exact: false });
  });
  it("adds up a day per menu and shift", () => {
    const lines = salesLines([trx(["Teh tarik"], 28000), trx(["Teh tarik", "Donat"], 24000), trx(["Teh tarik"], 14000, "2")], price);
    expect(lines).toEqual([
      { menu: "Teh tarik", shift: "1", qty: 3, guessed: 0 },
      { menu: "Donat", shift: "1", qty: 1, guessed: 0 },
      { menu: "Teh tarik", shift: "2", qty: 1, guessed: 0 },
    ]);
  });
});

describe("expected usage", () => {
  const items = new Map([
    [1, { unit: "ml", pack_size: null, pack_unit: "gr", min_stock: null }],     // Fresh Milk
    [2, { unit: "potong", pack_size: 200, pack_unit: "gr", min_stock: null }], // Ayam, 200 gr per potong
    [3, { unit: "biji", pack_size: null, pack_unit: "gr", min_stock: null }],  // Telur, no weight yet
  ]);
  const menus = [{ id: 10, name: "Caffe Latte", price: 22000 }, { id: 11, name: "Ayam Geprek", price: 20000 }];
  const recipe = [
    { menu_id: 10, item_id: 1, qty: "160 ml" },
    { menu_id: 11, item_id: 2, qty: "100 gr" },
    { menu_id: 11, item_id: 3, qty: "30 gr" },
  ];
  it("does not read 5 pcs as 5 of a pack", () => {
    const pack = new Map([[4, { unit: "pack", pack_size: null, pack_unit: "gr", min_stock: null }]]);
    const m = [{ id: 1, name: "Gyoza", price: 17000 }];
    expect(expectedUsage([{ menu: "Gyoza", qty: 2 }], m, [{ menu_id: 1, item_id: 4, qty: "5 pcs" }], pack).expected.get(4)?.readable).toBe(false);
    expect(expectedUsage([{ menu: "Gyoza", qty: 2 }], m, [{ menu_id: 1, item_id: 4, qty: "1/2 pack" }], pack).expected.get(4)?.amount).toBe(1);
  });
  it("converts recipe amounts into the unit staff count in", () => {
    const { expected, noRecipe } = expectedUsage(
      [{ menu: "caffe latte", qty: 4 }, { menu: "Ayam Geprek", qty: 3 }, { menu: "Rasi Nara", qty: 2 }], menus, recipe, items);
    expect(expected.get(1)).toMatchObject({ amount: 640, readable: true });
    expect(expected.get(2)).toMatchObject({ amount: 1.5, readable: true });
    expect(expected.get(3)?.readable).toBe(false);
    expect(noRecipe).toEqual(new Map([["Rasi Nara", 2]]));
  });
  it("flags counts far from the recipes", () => {
    expect(verdict(1000, 1100)).toBe("ok");
    expect(verdict(1000, 1300)).toBe("lebih");
    expect(verdict(1000, 600)).toBe("kurang");
    expect(verdict(1, 1.4)).toBe("ok");
  });
});
