// Daily turnover (omzet) from the Majoo "Detail Penjualan" export: per payment method, per shift, per week,
// and which menus appear in the most transactions. Omzet is Majoo's "Total Penjualan (Rp)" per transaction.

export type Method = "tunai" | "qris" | "lain";

export const METHODS: { id: Method; label: string }[] = [
  { id: "tunai", label: "Tunai" },
  { id: "qris", label: "QRIS" },
  { id: "lain", label: "Lainnya" },
];

/** "Cash" → tunai, "Bank Transfer - Qris" → qris; anything else (split payments, other banks) stays visible as lainnya. */
export function methodOf(method: string): Method {
  const m = method.toLowerCase();
  const cash = /\b(cash|tunai)\b/.test(m);
  const qris = /qris/.test(m);
  if (cash && !qris) return "tunai";
  if (qris && !cash) return "qris";
  return "lain";
}

export type TrxRow = { trx_no: string; shift: string; method: string; total: number; products: string[] };

export type Split = Record<Method, number>;
const emptySplit = (): Split => ({ tunai: 0, qris: 0, lain: 0 });

export type DaySummary = {
  count: number;
  total: number;
  byMethod: Split;
  countByMethod: Split;
  /** Omzet per shift ("1", "2", or "" when Majoo has no shift) and method. */
  byShift: Map<string, Split & { count: number; total: number }>;
  /** Raw Majoo method names that ended up in "lain", so they can be checked. */
  otherMethods: Map<string, number>;
};

export function summarize(trx: TrxRow[]): DaySummary {
  const s: DaySummary = { count: 0, total: 0, byMethod: emptySplit(), countByMethod: emptySplit(), byShift: new Map(), otherMethods: new Map() };
  for (const t of trx) {
    const m = methodOf(t.method);
    s.count++;
    s.total += t.total;
    s.byMethod[m] += t.total;
    s.countByMethod[m]++;
    if (m === "lain") s.otherMethods.set(t.method || "(kosong)", (s.otherMethods.get(t.method || "(kosong)") ?? 0) + t.total);
    const sh = s.byShift.get(t.shift) ?? { ...emptySplit(), count: 0, total: 0 };
    sh[m] += t.total;
    sh.count++;
    sh.total += t.total;
    s.byShift.set(t.shift, sh);
  }
  return s;
}

/**
 * Menus by the number of transactions they appear in. Majoo lists each menu once per transaction without a quantity,
 * so this counts transactions, not portions.
 */
export function topMenus(trx: TrxRow[]) {
  const n = new Map<string, number>();
  for (const t of trx) for (const p of new Set(t.products)) n.set(p, (n.get(p) ?? 0) + 1);
  return [...n].map(([menu, count]) => ({ menu, count })).sort((a, b) => b.count - a.count || a.menu.localeCompare(b.menu));
}

/** Monday of the week a date falls in, as YYYY-MM-DD. */
export function weekStart(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export const addDays = (date: string, days: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export type DayTotals = { sale_date: string; trx_count: number; total: number; tunai: number | null; qris: number | null; lain: number | null };

export type Week = { start: string; days: number; count: number; total: number; split: Split; splitKnown: boolean };

/** Days grouped into Monday–Sunday weeks, newest first. `splitKnown` is false when a day was uploaded before methods were stored. */
export function weeks(days: DayTotals[]): Week[] {
  const by = new Map<string, Week>();
  for (const d of days) {
    const start = weekStart(d.sale_date);
    const w = by.get(start) ?? { start, days: 0, count: 0, total: 0, split: emptySplit(), splitKnown: true };
    w.days++;
    w.count += d.trx_count;
    w.total += d.total;
    if (d.tunai == null) w.splitKnown = false;
    w.split.tunai += d.tunai ?? 0;
    w.split.qris += d.qris ?? 0;
    w.split.lain += d.lain ?? 0;
    by.set(start, w);
  }
  return [...by.values()].sort((a, b) => b.start.localeCompare(a.start));
}

export const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");
