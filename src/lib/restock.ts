import { formatQty, parseQty } from "./qty";
import { CATEGORIES, dateLabel, type Item, type LineRow } from "./types";

export type Need = { item: Item; sisa: number; reason: "habis" | "menipis" };

/** Items that ran out or fell below their minimum in one count. */
export function restockNeeds(items: Item[], lines: Map<number, LineRow>) {
  const needs: Need[] = [];
  let counted = 0;
  for (const item of items) {
    const sisa = parseQty(lines.get(item.id)?.tersedia, item);
    if (sisa == null || Number.isNaN(sisa)) continue;
    counted++;
    if (sisa <= 0) needs.push({ item, sisa: 0, reason: "habis" });
    else if (item.min_stock && sisa < item.min_stock) needs.push({ item, sisa, reason: "menipis" });
  }
  return { needs, counted };
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
