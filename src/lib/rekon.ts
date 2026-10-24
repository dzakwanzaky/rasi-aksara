// Rekonsiliasi harian (Zaky, 23 Okt 2026): omzet per payment method in Majoo against the money that actually came in.
// Tunai: the drawer count staff type in Laporan, per shift. QRIS: the amount the owner sees on the bank statement,
// typed per sale date. Nothing is guessed: a missing number leaves the check open instead of counting as zero.

import { DEFAULT_MODAL } from "./laporan";

export type Settings = {
  /** Fee the QRIS provider keeps, in percent of the sale (e.g. 0.7). Null until the owner fills it in. */
  qris_fee_pct: number | null;
  /** Days between the sale and the money reaching the bank. Only used to say which statement date to look at. */
  qris_lag_days: number | null;
  /** A day whose total difference is bigger than this (either way) is marked. Null: nothing is marked. */
  batas_selisih: number | null;
};

export type ShiftReport = { shift: string; tunai_aktual: number | null; modal: number | null; pengeluaran: number | null };

/** Majoo cash sales per Majoo shift ("1", "2", or "" when the export has no shift). */
export type CashByShift = Map<string, number>;

export type TunaiCheck = {
  majoo: number;
  /** Cash that should be in the drawer: Majoo cash + modal − cash spent from the drawer. Null while a report is missing. */
  seharusnya: number | null;
  aktual: number | null;
  selisih: number | null;
  /** Shifts with Majoo cash sales but no drawer count in Laporan. */
  missing: string[];
};

/**
 * Drawer check for one day. Each Laporan report is one drawer count: a "12" report (shift 1 & 2 together) covers the whole
 * day, otherwise shift 1 and shift 2 are checked separately against the Majoo cash of that shift and added up.
 */
export function tunaiCheck(cash: CashByShift, reports: ShiftReport[]): TunaiCheck {
  const majoo = [...cash.values()].reduce((s, n) => s + n, 0);
  const counted = reports.filter((r) => r.tunai_aktual != null);
  const whole = counted.find((r) => r.shift === "12");
  const groups = whole
    ? [{ report: whole, cash: majoo }]
    : counted.map((r) => ({ report: r, cash: cash.get(r.shift) ?? 0 }));

  const covered = new Set(whole ? [...cash.keys()] : counted.map((r) => r.shift));
  const missing = [...cash].filter(([shift, n]) => n > 0 && !covered.has(shift)).map(([shift]) => shift).sort();
  if (!groups.length) return { majoo, seharusnya: null, aktual: null, selisih: null, missing: missing.length ? missing : ["1"] };

  const seharusnya = groups.reduce((s, g) => s + g.cash + (g.report.modal ?? DEFAULT_MODAL) - (g.report.pengeluaran ?? 0), 0);
  const aktual = groups.reduce((s, g) => s + g.report.tunai_aktual!, 0);
  if (missing.length) return { majoo, seharusnya: null, aktual, selisih: null, missing };
  return { majoo, seharusnya, aktual, selisih: aktual - seharusnya, missing };
}

export type QrisCheck = {
  majoo: number;
  /** Majoo QRIS minus the provider fee; null while the fee is not set. */
  bersih: number | null;
  masuk: number | null;
  /** Against `bersih` when the fee is set, otherwise against the gross Majoo amount. */
  selisih: number | null;
  feeKnown: boolean;
};

export function qrisCheck(majoo: number, masuk: number | null, feePct: number | null): QrisCheck {
  const bersih = feePct == null ? null : Math.round(majoo * (1 - feePct / 100));
  const expected = bersih ?? majoo;
  return { majoo, bersih, masuk, selisih: masuk == null ? null : masuk - expected, feeKnown: feePct != null };
}

export type DayState = "ok" | "besar" | "belum";

/** "belum" while either check is open; "besar" when the total difference is over the limit. */
export function dayState(t: TunaiCheck, q: QrisCheck, batas: number | null): { state: DayState; total: number | null } {
  if (t.selisih == null || (q.majoo > 0 && q.selisih == null)) return { state: "belum", total: null };
  const total = t.selisih + (q.selisih ?? 0);
  const over = batas != null && (Math.abs(t.selisih) > batas || Math.abs(q.selisih ?? 0) > batas || Math.abs(total) > batas);
  return { state: over ? "besar" : "ok", total };
}

export const signed = (n: number, fmt: (n: number) => string) => (n > 0 ? "+" : "") + fmt(n);
