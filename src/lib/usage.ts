import { parseQty } from "./qty";
import { isStatusItem, readStatus, type Item, type LineRow } from "./types";

export type UsageStatus = "used" | "same" | "up" | "notcounted" | "noprev" | "unreadable" | "status";

/** Terpakai (used) = stok kemarin + barang masuk − sisa sekarang */
export function usageOf(item: Item, l: Partial<LineRow> | undefined) {
  // Operasional items only say "masih ada" / "perlu beli": no usage number.
  const st = isStatusItem(item) ? readStatus(l?.tersedia) : null;
  // Older lines of an item switched to status_only still hold numbers: show those as numbers.
  if (isStatusItem(item) && (st || !String(l?.tersedia ?? "").trim())) {
    return { kemarin: null, masuk: 0, sisa: null, used: 0, status: (st ? "status" : "notcounted") as UsageStatus, stockStatus: st };
  }
  const kemarin = parseQty(l?.awal, item);
  const masuk = parseQty(l?.masuk, item) ?? 0;
  const sisa = parseQty(l?.tersedia, item);
  let status: UsageStatus;
  let used = 0;
  if (sisa == null) status = "notcounted";
  else if (Number.isNaN(sisa) || Number.isNaN(masuk) || Number.isNaN(kemarin)) status = "unreadable";
  else if (kemarin == null) status = "noprev";
  else {
    used = kemarin + masuk - sisa;
    status = used > 1e-9 ? "used" : used < -1e-9 ? "up" : "same";
  }
  return { kemarin, masuk, sisa, used, status, stockStatus: null };
}

export function usageSummary(items: Item[], lines: Map<number, LineRow>) {
  let counted = 0, used = 0, check = 0;
  for (const item of items) {
    const { status } = usageOf(item, lines.get(item.id));
    if (status !== "notcounted") counted++;
    if (status === "used") used++;
    if (status === "up" || status === "unreadable") check++;
  }
  return { counted, used, check, total: items.length };
}
