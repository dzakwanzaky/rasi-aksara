import { describe, expect, it } from "vitest";
import { restockNeeds } from "./restock";
import type { Item, LineRow } from "./types";

const item = (id: number, min: number | null): Item =>
  ({ id, name: `Bahan ${id}`, category: "Bar", unit: "pcs", min_stock: min, pack_size: null, pack_unit: "gr", sort_order: id, active: true });
const line = (item_id: number, awal: string | null, masuk: string | null, tersedia: string | null): LineRow =>
  ({ session_id: "s", item_id, awal, masuk, tersedia });

describe("restockNeeds", () => {
  const items = [item(1, 5), item(2, 5), item(3, null)];
  it("drops an item from the list once its delivery is entered", () => {
    const before = restockNeeds(items, new Map([[1, line(1, "2", null, null)], [3, line(3, "0", null, null)]]));
    expect(before.needs.map((n) => n.item.id)).toEqual([1, 3]);
    const after = restockNeeds(items, new Map([[1, line(1, "2", "10", null)], [3, line(3, "0", "4", null)]]));
    expect(after.needs).toEqual([]);
    expect(after.estimated).toBe(2);
  });
  it("uses the end-of-shift count once it is filled in", () => {
    const r = restockNeeds(items, new Map([[1, line(1, "2", "10", "3")]]));
    expect(r.needs).toMatchObject([{ item: { id: 1 }, sisa: 3, reason: "menipis", estimated: false }]);
  });
  it("lists an item whose count equals its minimum", () => {
    const r = restockNeeds([item(1, 2000)], new Map([[1, line(1, null, null, "2000")]]));
    expect(r.needs).toMatchObject([{ item: { id: 1 }, sisa: 2000, reason: "menipis" }]);
  });
  it("skips items with nothing known", () => {
    expect(restockNeeds(items, new Map([[2, line(2, null, "3", null)]])).counted).toBe(0);
  });
});
