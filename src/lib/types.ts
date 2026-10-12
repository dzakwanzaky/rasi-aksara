export const CATEGORIES = ["Packaging", "Bar", "Dapur"] as const;
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
