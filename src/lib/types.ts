export const CATEGORIES = ["Packaging", "Bar", "Dapur", "Operasional"] as const;
export type Category = (typeof CATEGORIES)[number];

export type Item = {
  id: number;
  name: string;
  category: Category;
  unit: string;
  pack_size: number | null;
  pack_unit: "gr" | "ml";
  min_stock: number | null;
  sort_order: number;
  active: boolean;
  /** Only "Masih Ada Stock" / "Perlu Beli", no number. Always true for Operasional. */
  status_only?: boolean;
};

export type Session = { id: string; count_date: string; note: string; created_at: string };

export type LineRow = {
  session_id: string;
  item_id: number;
  awal: string | null;
  masuk: string | null;
  tersedia: string | null;
};

export const sortItems = (items: Item[]) =>
  [...items].sort(
    (a, b) =>
      CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  );

export const dateLabel = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

/** Items that are not counted: staff only mark them "Masih Ada Stock" or "Perlu Beli".
 * Every Operasional item, plus any item the admin switched to status_only in Bahan.
 * The choice is stored in the line's "tersedia" as "ada" / "beli". */
export const isStatusItem = (i: { category: string; status_only?: boolean | null }) =>
  i.category === "Operasional" || !!i.status_only;

export type StockStatus = "ada" | "beli";
export const STATUS_LABEL: Record<StockStatus, string> = { ada: "Masih Ada Stock", beli: "Perlu Beli" };

export function readStatus(raw: string | null | undefined): StockStatus | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "ada" || s === "beli" ? s : null;
}
