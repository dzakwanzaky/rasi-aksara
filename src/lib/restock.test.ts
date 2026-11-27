import { describe, expect, it } from "vitest";
import { restockNeeds, restockText } from "./restock";
import { usageOf, usageSummary } from "./usage";
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
  describe("operasional items (Masih Ada Stock / Perlu Beli)", () => {
    const sabun: Item = { ...item(9, null), name: "Sunlight", category: "Operasional", unit: "status" };
    it("lists an item marked perlu beli", () => {
      const r = restockNeeds([sabun], new Map([[9, line(9, "ada", null, "beli")]]));
      expect(r.needs).toMatchObject([{ item: { id: 9 }, reason: "beli", estimated: false }]);
      expect(restockText(r.needs, "2026-11-27")).toContain("- Sunlight: PERLU BELI");
    });
    it("keeps last night's perlu beli until today's choice is made", () => {
      expect(restockNeeds([sabun], new Map([[9, line(9, "beli", null, null)]])).needs).toMatchObject([{ estimated: true }]);
      expect(restockNeeds([sabun], new Map([[9, line(9, "beli", null, "ada")]])).needs).toEqual([]);
    });
    it("counts a packaging item switched to status_only by status, keeping its older numbers", () => {
      const cup: Item = { ...item(4, 50), status_only: true };
      expect(restockNeeds([cup], new Map([[4, line(4, "80", null, "beli")]])).needs).toMatchObject([{ reason: "beli" }]);
      expect(usageOf(cup, line(4, "80", null, "60"))).toMatchObject({ status: "used", used: 20 });
    });
    it("never shows up as usage", () => {
      const u = usageOf(sabun, line(9, "ada", null, "beli"));
      expect(u).toMatchObject({ status: "status", used: 0, stockStatus: "beli" });
      const sum = usageSummary([sabun, item(1, null)], new Map([[9, line(9, "ada", null, "beli")], [1, line(1, "5", null, "3")]]));
      expect(sum).toEqual({ counted: 2, used: 1, check: 0, total: 2 });
    });
  });
});
