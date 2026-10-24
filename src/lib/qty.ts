// Reads quantities the way they are written on the opname sheet:
// "3, 3/4" (3 full + 3/4 bottle), "3 1/2 pack", "923 gr", "2,3kg", "5, 329 gr" (5 packs + 329 gr), "-".

export type QtyItem = {
  unit: string;
  pack_size: number | null;
  pack_unit: string;
  min_stock: number | null;
};

export type Line = { awal: string | null; masuk: string | null; tersedia: string | null };

const MEASURE: Record<string, ["g" | "ml", number]> = {
  kg: ["g", 1000], kilo: ["g", 1000], gram: ["g", 1], grm: ["g", 1], gr: ["g", 1], g: ["g", 1],
  ml: ["ml", 1], liter: ["ml", 1000], ltr: ["ml", 1000], l: ["ml", 1000],
};

const measureOf = (u: string | null | undefined) => MEASURE[String(u ?? "").trim().toLowerCase()] ?? null;

function toNumber(s: string): number {
  // "4,000" / "4.000" are thousands; otherwise a comma is a decimal point ("2,3").
  if (/^\d{1,3}[.,]\d{3}$/.test(s)) return Number(s.replace(/[.,]/, ""));
  return Number(s.replace(",", "."));
}

/** null = blank, NaN = could not be read in the item's unit. */
export function parseQty(raw: string | null | undefined, item: QtyItem): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (/^[-–—]+$/.test(s)) return 0;

  const re = /(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?(?:\s*(kg|kilo|gram|grm|gr|g|ml|liter|ltr|l)(?![a-z]))?/g;
  const itemMeasure = measureOf(item.unit);
  const packMeasure = item.pack_size && item.pack_size > 0 ? measureOf(item.pack_unit || "gr") : null;

  let total = 0;
  let found = false;
  for (const m of s.matchAll(re)) {
    found = true;
    let n = toNumber(m[1]);
    if (m[2]) n = n / Number(m[2]);
    if (!m[3]) {
      total += n;
      continue;
    }
    const [kind, factor] = MEASURE[m[3]];
    const base = n * factor;
    if (itemMeasure && itemMeasure[0] === kind) total += base / itemMeasure[1];
    else if (packMeasure && packMeasure[0] === kind) total += base / (packMeasure[1] * item.pack_size!);
    else return NaN;
  }
  return found ? Math.round(total * 10000) / 10000 : NaN;
}

export type Flag = { level: "warn" | "bad"; label: string };

export function calcLine(line: Partial<Line> | undefined, item: QtyItem) {
  const awal = parseQty(line?.awal, item);
  const masuk = parseQty(line?.masuk, item);
  const tersedia = parseQty(line?.tersedia, item);
  const readable = (x: number | null): x is number => x != null && !Number.isNaN(x);

  // Keluar (usage) = Awal + Masuk − Tersedia
  const keluar =
    readable(awal) && readable(tersedia) && !Number.isNaN(masuk ?? 0) ? awal + (masuk ?? 0) - tersedia : null;

  const flags: Flag[] = [];
  if ([awal, masuk, tersedia].some((x) => Number.isNaN(x)))
    flags.push({ level: "bad", label: item.pack_size ? "cek format" : "isi ukuran kemasan" });
  if (keluar != null && keluar < -1e-9) flags.push({ level: "bad", label: "lebih dari awal+masuk" });
  if (tersedia === 0) flags.push({ level: "warn", label: "habis" });
  else if (readable(tersedia) && item.min_stock && item.min_stock > 0 && tersedia <= item.min_stock)
    flags.push({ level: "warn", label: tersedia < item.min_stock ? "di bawah minimum" : "pas di minimum" });

  return { awal, masuk, tersedia, keluar, flags };
}

export function formatQty(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "";
  return (Math.round(n * 100) / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}
