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
 * Drawer check for one day. Each Laporan report is one drawer count: shift 1 and shift 2 are checked separately against the
 * Majoo cash of that shift and added up; a "12" report (shift 1 & 2 together) covers the whole day when neither shift has one.
 */
export function tunaiCheck(cash: CashByShift, reports: ShiftReport[]): TunaiCheck {
  const majoo = [...cash.values()].reduce((s, n) => s + n, 0);
  const counted = reports.filter((r) => r.tunai_aktual != null && ["1", "2", "12"].includes(r.shift));
  // Separate shift counts win over a "shift 1 & 2" report, so the owner's per-shift count replaces a combined one.
  const whole = counted.some((r) => r.shift === "1" || r.shift === "2") ? undefined : counted.find((r) => r.shift === "12");
  const groups = whole
    ? [{ report: whole, cash: majoo }]
    : counted.filter((r) => r.shift !== "12").map((r) => ({ report: r, cash: cash.get(r.shift) ?? 0 }));

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

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

export type CashLine = { date: string; shift: "1" | "2"; amount: number };

/**
 * Drawer counts typed as text, one per line, the way the owner writes them in chat:
 * "22 okt shift 1 517000", "24 okt shift 2 1.315.000", "23 Oktober shift 2 Rp 555.000".
 * The amount is after taking out the modal. Lines that can't be read come back in `bad`.
 */
export function parseCashText(text: string, year: number): { rows: CashLine[]; bad: string[] } {
  const rows: CashLine[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(\d{1,2})\s*([a-z]+)\.?\s+s\w*\s*([12])\b\D*?([\d.,]+)\s*(rb|ribu|k)?\s*$/i.exec(line.replace(/rp\.?/gi, " "));
    const month = m ? MONTHS[m[2].toLowerCase().slice(0, 3)] : undefined;
    const digits = m ? m[4].replace(/[.,](?=\d{3}\b)/g, "") : "";
    let amount = /^\d+$/.test(digits) ? Number(digits) : NaN;
    if (m?.[5]) amount *= 1000;
    const day = m ? Number(m[1]) : 0;
    const date = month ? new Date(Date.UTC(year, month - 1, day)) : null;
    if (!m || !date || date.getUTCDate() !== day || !Number.isFinite(amount)) {
      bad.push(line);
      continue;
    }
    rows.push({ date: date.toISOString().slice(0, 10), shift: m[3] as "1" | "2", amount });
  }
  return { rows, bad };
}
