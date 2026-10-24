import { formatQty, parseQty } from "./qty";
import { CATEGORIES, dateLabel, type Item, type LineRow } from "./types";

export type Need = { item: Item; sisa: number; reason: "habis" | "menipis"; estimated: boolean };

/** Stock on hand for one item: the end-of-shift count when it is filled in, otherwise
 * last night's count plus what came in today. Null when neither is known. */
export function currentStock(item: Item, line: LineRow | undefined): { qty: number; estimated: boolean } | null {
  const sisa = parseQty(line?.tersedia, item);
  if (sisa != null && !Number.isNaN(sisa)) return { qty: sisa, estimated: false };
  const awal = parseQty(line?.awal, item);
  if (awal == null || Number.isNaN(awal)) return null;
  const masuk = parseQty(line?.masuk, item);
  return { qty: awal + (masuk != null && !Number.isNaN(masuk) ? masuk : 0), estimated: true };
}

/** Items that ran out or fell below their minimum, counting deliveries that arrived after the last count. */
export function restockNeeds(items: Item[], lines: Map<number, LineRow>) {
  const needs: Need[] = [];
  let counted = 0;
  let estimated = 0;
  for (const item of items) {
    const now = currentStock(item, lines.get(item.id));
    if (!now) continue;
    counted++;
    if (now.estimated) estimated++;
    if (now.qty <= 0) needs.push({ item, sisa: 0, reason: "habis", estimated: now.estimated });
    else if (item.min_stock && now.qty <= item.min_stock) needs.push({ item, sisa: now.qty, reason: "menipis", estimated: now.estimated });
  }
  return { needs, counted, estimated };
}

/** Plain-text purchase list, formatted for WhatsApp/Telegram. */
export function restockText(needs: Need[], countDate: string) {
  return [
    `Belanja Rasi Aksara (stok ${dateLabel(countDate)})`,
    ...CATEGORIES.flatMap((c) => {
      const g = needs.filter((n) => n.item.category === c);
      return g.length
        ? ["", `*${c}*`, ...g.map((n) => `- ${n.item.name}: ${n.reason === "habis" ? "HABIS" : `sisa ${formatQty(n.sisa)} ${n.item.unit}`}${n.item.min_stock ? ` (min ${formatQty(n.item.min_stock)})` : ""}`)]
        : [];
    }),
  ].join("\n");
}
