import { createClient } from "@/lib/supabase/server";
import { SHIFTS, hasil, selisih, shiftLabel, type Report } from "@/lib/laporan";

// Laporan harian for one month (?bulan=2026-10), or every report without it, one row per shift,
// with the same columns as the old LAPORAN HARIAN sheet. Opens in Excel / Google Sheets.
export async function GET(req: Request) {
  const bulan = new URL(req.url).searchParams.get("bulan") ?? "";
  const supabase = await createClient();
  let q = supabase.from("daily_reports").select("*").order("report_date");
  if (/^\d{4}-\d{2}$/.test(bulan)) {
    const [y, m] = bulan.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    q = q.gte("report_date", `${bulan}-01`).lt("report_date", `${next}-01`);
  }
  const { data, error } = await q.limit(5000);
  if (error) return new Response(error.message, { status: 500 });
  const order = (s: string) => SHIFTS.findIndex((x) => x.id === s);
  const reports = ((data ?? []) as Report[]).sort((a, b) => a.report_date.localeCompare(b.report_date) || order(a.shift) - order(b.shift));

  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: unknown[][] = [[
    "TANGGAL", "SHIFT", "OMSET", "TUNAI SISTEM", "TF SISTEM", "TUNAI AKTUAL", "PLUS", "MINUS",
    "PENGELUARAN", "KETERANGAN PENGELUARAN", "MODAL", "HASIL", "CATATAN", "DIISI OLEH",
  ]];
  for (const r of reports) {
    const d = selisih(r);
    rows.push([
      r.report_date, shiftLabel(r.shift), r.omset, r.tunai_sistem, r.tf_sistem, r.tunai_aktual,
      d != null && d > 0 ? d : "", d != null && d < 0 ? -d : "",
      r.pengeluaran, r.pengeluaran_note, r.modal, hasil(r), r.catatan, r.updated_by_name,
    ]);
  }
  // The byte-order mark makes Excel read the file as UTF-8.
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-harian-${bulan || "semua"}.csv"`,
    },
  });
}
