// Laporan harian (Zaky, 15 Okt 2026), from his LAPORAN HARIAN sheet: one report per shift with
// omset, tunai & transfer from the system (Majoo), the cash actually in the drawer, expenses and modal.
// Plus/minus and hasil are worked out here, not typed.

export type ShiftId = "1" | "2" | "12";

export const SHIFTS: { id: ShiftId; label: string }[] = [
  { id: "1", label: "Shift 1" },
  { id: "2", label: "Shift 2" },
  { id: "12", label: "Shift 1 & 2" },
];
export const shiftLabel = (id: string) => SHIFTS.find((s) => s.id === id)?.label ?? id;

export const MONEY_FIELDS = [
  { key: "omset", label: "Omset", hint: "Total penjualan di Majoo" },
  { key: "tunai_sistem", label: "Tunai sistem", hint: "Penjualan tunai di Majoo" },
  { key: "tf_sistem", label: "TF sistem", hint: "Penjualan transfer / QRIS di Majoo" },
  { key: "tunai_aktual", label: "Tunai aktual", hint: "Uang tunai yang dihitung di laci" },
  { key: "pengeluaran", label: "Pengeluaran", hint: "Uang laci yang dipakai belanja" },
  { key: "modal", label: "Modal", hint: "Modal kasir awal shift" },
] as const;
export type MoneyKey = (typeof MONEY_FIELDS)[number]["key"];
export const DEFAULT_MODAL = 200000;

export type Report = {
  report_date: string;
  shift: ShiftId;
  pengeluaran_note: string | null;
  catatan: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
} & Record<MoneyKey, number | null>;

/** Plus (positive) or minus (negative): cash in the drawer against cash sales in the system. */
export function selisih(r: Partial<Report>): number | null {
  if (r.tunai_aktual == null || r.tunai_sistem == null) return null;
  return r.tunai_aktual - r.tunai_sistem;
}

/** Hasil = tunai aktual − modal, as in the sheet's 5 Okt column (698.000 − 200.000 = 498.000). */
export function hasil(r: Partial<Report>): number | null {
  if (r.tunai_aktual == null) return null;
  return r.tunai_aktual - (r.modal ?? DEFAULT_MODAL);
}

/** Sales that are neither tunai nor TF in the system (e.g. ojol). Null while a number is missing. */
export function omsetLain(r: Partial<Report>): number | null {
  if (r.omset == null || r.tunai_sistem == null || r.tf_sistem == null) return null;
  return r.omset - r.tunai_sistem - r.tf_sistem;
}

/** Shift 1 runs 07.00–14.30, then shift 2 (from the shift checklist). */
export const shiftForTime = (hour: number, minute: number): ShiftId => (hour * 60 + minute < 14 * 60 + 30 ? "1" : "2");

/** Reads "1.673.000", "1673000", "Rp 1.673.000" or "1,5jt"-free plain rupiah. Empty → null, junk → NaN. */
export function readRupiah(v: string): number | null {
  const s = v.replace(/rp/i, "").replace(/[\s.]/g, "").replace(/,\d{1,2}$/, "");
  if (!s) return null;
  return /^-?\d+$/.test(s) ? Number(s) : NaN;
}

export const formatNumber = (n: number | null | undefined) => (n == null ? "" : Math.round(n).toLocaleString("id-ID"));
export const rupiah = (n: number) => (n < 0 ? "−" : "") + "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");

export function totals(reports: Partial<Report>[]) {
  const sum = (f: (r: Partial<Report>) => number | null | undefined) =>
    reports.reduce((t, r) => t + (f(r) ?? 0), 0);
  return {
    omset: sum((r) => r.omset),
    pengeluaran: sum((r) => r.pengeluaran),
    plus: sum((r) => Math.max(0, selisih(r) ?? 0)),
    minus: sum((r) => Math.min(0, selisih(r) ?? 0)),
    hasil: sum(hasil),
  };
}
