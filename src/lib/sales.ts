// Daily sales from Majoo's "Detail Penjualan" export, and the stock the recipes say those sales should have used.
// The export lists the menus of each transaction ("Rasi Nara,Donat") but not how many of each,
// so quantities are worked out from the menu prices and the transaction total.

import { unzipSync, strFromU8 } from "fflate";
import { COUNT_DAY_STARTS_AT } from "./data";
import { parseQty, type QtyItem } from "./qty";

export type Shift = "1" | "2" | "";

export type Trx = { no: string; date: string; shift: Shift; products: string[]; total: number };

export type SaleLine = { menu: string; shift: Shift; qty: number; guessed: number };

export type Menu = { id: number; name: string; price: number | null };
export type RecipeLine = { menu_id: number; item_id: number; qty: string };

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");

/** The first sheet of an .xlsx as rows of cell text. Read by hand: Majoo's styles trip up spreadsheet libraries. */
export function readXlsxRows(file: Uint8Array): string[][] {
  const zip = unzipSync(file, { filter: (f) => f.name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet1\.xml$/.test(f.name) });
  const sheet = zip["xl/worksheets/sheet1.xml"];
  if (!sheet) throw new Error("Bukan file Excel (.xlsx) dari Majoo");
  const shared = zip["xl/sharedStrings.xml"]
    ? [...strFromU8(zip["xl/sharedStrings.xml"]).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]))
    : [];
  const rows: string[][] = [];
  for (const row of strFromU8(sheet).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const out: string[] = [];
    for (const c of row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+)\d+"/.exec(c[1])?.[1] ?? "";
      const col = [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const type = /t="(\w+)"/.exec(c[1])?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? "")?.[1];
      const val = type === "s" ? shared[Number(v)] ?? "" : type === "inlineStr" ? texts(c[2] ?? "") : decode(v ?? "");
      if (col >= 0) out[col] = val;
    }
    rows.push(Array.from(out, (x) => x ?? ""));
  }
  return rows;
}

/** "19-10-2026 08:09:26" → the day it counts for: before 06:00 it still belongs to the night before, like the stock count. */
export function saleDay(waktu: string): string | null {
  const m = /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/.exec(waktu.trim());
  if (!m) return null;
  const t = Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - COUNT_DAY_STARTS_AT, +m[5]);
  return new Date(t).toISOString().slice(0, 10);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Transactions of a Majoo "Detail Penjualan" export. */
export function parseMajoo(rows: string[][]): Trx[] {
  const h = rows.findIndex((r) => r.some((c) => norm(c) === "produk") && r.some((c) => norm(c) === "no transaksi"));
  if (h < 0) throw new Error("Kolom No Transaksi / Produk tidak ditemukan. Pakai export Detail Penjualan dari Majoo.");
  const col = (name: string) => rows[h].findIndex((c) => norm(c).startsWith(name));
  const [cNo, cTime, cProd, cTotal, cShift] = [col("no transaksi"), col("waktu order"), col("produk"), col("total penjualan"), col("order")];
  const out: Trx[] = [];
  for (const r of rows.slice(h + 1)) {
    const date = saleDay(r[cTime] ?? "");
    if (!r[cNo] || !date) continue;
    const shift = /(\d)/.exec(r[cShift] ?? "")?.[1];
    out.push({
      no: r[cNo],
      date,
      shift: shift === "1" || shift === "2" ? shift : "",
      products: (r[cProd] ?? "").split(",").map((p) => p.trim()).filter(Boolean),
      total: Number(r[cTotal]) || 0,
    });
  }
  return out;
}

/**
 * How many of each menu a transaction had: the smallest counts (each at least 1) whose prices add up to the total.
 * `exact` is false when a price is unknown or no combination fits; then every menu counts once.
 */
export function inferQty(t: Trx, price: (menu: string) => number | null | undefined) {
  const prices = t.products.map((p) => price(p) ?? null);
  const ones = { qty: t.products.map(() => 1), exact: false };
  if (!t.products.length || prices.some((p) => !p)) return ones;
  let best: number[] | null = null;
  let bestSum = Infinity;
  let ways = 0;
  const qty = t.products.map(() => 1);
  const walk = (i: number, left: number, sum: number) => {
    if (left < 0 || ways > 50) return;
    if (i === qty.length) {
      if (left !== 0) return;
      ways++;
      if (sum < bestSum) { bestSum = sum; best = [...qty]; }
      return;
    }
    for (let n = 1; n <= 8; n++) {
      qty[i] = n;
      walk(i + 1, left - n * prices[i]!, sum + n);
    }
    qty[i] = 1;
  };
  walk(0, t.total, 0);
  return best ? { qty: best as number[], exact: ways === 1 } : ones;
}

/** Portions per menu per shift for one day. `guessed` counts the portions that came from an unsure transaction. */
export function salesLines(trx: Trx[], price: (menu: string) => number | null | undefined): SaleLine[] {
  const by = new Map<string, SaleLine>();
  for (const t of trx) {
    const { qty, exact } = inferQty(t, price);
    t.products.forEach((menu, i) => {
      const key = `${menu}\u0000${t.shift}`;
      const line = by.get(key) ?? { menu, shift: t.shift, qty: 0, guessed: 0 };
      line.qty += qty[i];
      if (!exact) line.guessed += qty[i];
      by.set(key, line);
    });
  }
  return [...by.values()].sort((a, b) => b.qty - a.qty || a.menu.localeCompare(b.menu));
}

const MEASURES = new Set(["kg", "kilo", "gram", "grm", "gr", "g", "ml", "liter", "ltr", "l"]);

/** "5 pcs" for an item counted per pack is not 5 packs: any word besides gr/ml must be the item's own unit. */
function unitMatches(qty: string, unit: string) {
  const words = qty.toLowerCase().match(/[a-z]+/g) ?? [];
  return words.every((w) => MEASURES.has(w) || w === unit.trim().toLowerCase());
}

/** One portion's amount in the item's counting unit; NaN when it can't be converted, null when blank. */
export const recipeQty = (qty: string, item: QtyItem) => (unitMatches(qty, item.unit) ? parseQty(qty, item) : NaN);

export type Expected = { amount: number; readable: boolean; menus: Map<string, number> };

/**
 * Stock the sales should have used, per item, in the item's own counting unit.
 * A recipe amount like "100 gr" for an item counted per potong needs the item's isi per kemasan; without it `readable` is false.
 */
export function expectedUsage(
  sales: { menu: string; qty: number }[],
  menus: Menu[],
  recipe: RecipeLine[],
  items: Map<number, QtyItem>,
) {
  const menuByName = new Map(menus.map((m) => [norm(m.name), m]));
  const out = new Map<number, Expected>();
  const noRecipe = new Map<string, number>();
  for (const s of sales) {
    const menu = menuByName.get(norm(s.menu));
    const lines = menu ? recipe.filter((r) => r.menu_id === menu.id) : [];
    if (!lines.length) {
      noRecipe.set(s.menu, (noRecipe.get(s.menu) ?? 0) + s.qty);
      continue;
    }
    for (const r of lines) {
      const item = items.get(r.item_id);
      if (!item) continue;
      const per = recipeQty(r.qty, item);
      const e = out.get(r.item_id) ?? { amount: 0, readable: true, menus: new Map() };
      if (per == null || Number.isNaN(per)) e.readable = false;
      else e.amount += per * s.qty;
      e.menus.set(menu!.name, (e.menus.get(menu!.name) ?? 0) + s.qty);
      out.set(r.item_id, e);
    }
  }
  return { expected: out, noRecipe };
}

/** How far the counted usage is from what the recipes expect; "ok" within 15% (or a small absolute gap). */
export function verdict(expected: number, counted: number): "ok" | "lebih" | "kurang" {
  const gap = counted - expected;
  const tol = Math.max(expected * 0.15, 0.5);
  return gap > tol ? "lebih" : gap < -tol ? "kurang" : "ok";
}
