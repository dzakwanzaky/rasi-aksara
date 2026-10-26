"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { DEFAULT_MODAL, readRupiah } from "@/lib/laporan";
import { parseCashText, type CashLine } from "@/lib/rekon";
import { accountLabel } from "@/lib/staff";

const REKON = "/omzet/rekonsiliasi";

async function adminClient() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/omzet");
  return supabase;
}

const back = (msg?: string, anchor = "", key = "error"): never =>
  redirect(`${REKON}${msg ? `?${key}=${encodeURIComponent(msg)}` : ""}${anchor}`);

/**
 * Drawer counts from the owner, after the modal is taken out. Stored on the Laporan report of that shift as
 * tunai aktual = count + modal, so the report's own modal, spending and the staff's other numbers stay as they are.
 */
async function saveCounts(supabase: Awaited<ReturnType<typeof createClient>>, lines: CashLine[]) {
  const { data: { session } } = await supabase.auth.getSession();
  const by = accountLabel(session?.user.email);
  const dates = [...new Set(lines.map((l) => l.date))];
  const { data: existing } = await supabase.from("daily_reports").select("report_date, shift, modal").in("report_date", dates);
  const modal = new Map((existing ?? []).map((r) => [`${r.report_date}/${r.shift}`, r.modal as number | null]));
  for (const l of lines) {
    const known = modal.has(`${l.date}/${l.shift}`);
    const m = modal.get(`${l.date}/${l.shift}`) ?? DEFAULT_MODAL;
    const row = { tunai_aktual: l.amount + m, updated_by_name: by, updated_at: new Date().toISOString() };
    const { error } = known
      ? await supabase.from("daily_reports").update(row).eq("report_date", l.date).eq("shift", l.shift)
      : await supabase.from("daily_reports").insert({ report_date: l.date, shift: l.shift, modal: m, ...row });
    if (error) back(`Gagal menyimpan ${l.date} shift ${l.shift}: ${error.message}. Sudah jalankan 0014_rekonsiliasi.sql (versi terbaru) di Supabase?`);
  }
}

/** The two drawer counts of one day, typed in the day's card. An empty box leaves that shift as it is. */
export async function saveCash(form: FormData) {
  const supabase = await adminClient();
  const date = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back("Tanggal tidak valid.");
  const lines: CashLine[] = [];
  for (const shift of ["1", "2"] as const) {
    const amount = readRupiah(String(form.get(`shift${shift}`) ?? ""));
    if (Number.isNaN(amount)) back(`Uang aktual shift ${shift}: tulis angka saja, mis. 517.000.`, `#d${date}`);
    if (amount != null) lines.push({ date, shift, amount });
  }
  await saveCounts(supabase, lines);
  revalidatePath(REKON);
  back(undefined, `#d${date}`);
}

/** Many drawer counts pasted as text, e.g. "22 okt shift 1 517000", one per line. */
export async function pasteCash(form: FormData) {
  const supabase = await adminClient();
  const year = Number(new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta", year: "numeric" }));
  const { rows, bad } = parseCashText(String(form.get("text") ?? ""), year);
  if (!rows.length) back(bad.length ? `Tidak ada baris yang terbaca. Contoh: 22 okt shift 1 517000` : "Tempel teksnya dulu.");
  await saveCounts(supabase, rows);
  revalidatePath(REKON);
  const msg = `${rows.length} hitungan tersimpan.` + (bad.length ? ` Tidak terbaca: ${bad.join(" · ")}` : "");
  back(msg, "", "ok");
}

/** QRIS that reached the bank for one sale date. An empty box removes the amount. */
export async function saveQris(form: FormData) {
  const supabase = await adminClient();
  const date = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back("Tanggal tidak valid.");
  const amount = readRupiah(String(form.get("amount") ?? ""));
  if (Number.isNaN(amount)) back(`QRIS ${date}: tulis angka saja, mis. 2.672.000.`, `#d${date}`);
  if (amount == null) {
    await supabase.from("qris_masuk").delete().eq("sale_date", date);
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("qris_masuk").upsert({
      sale_date: date, amount, updated_by_name: accountLabel(session?.user.email), updated_at: new Date().toISOString(),
    });
    if (error) back(`Gagal menyimpan: ${error.message}. Sudah jalankan 0014_rekonsiliasi.sql di Supabase?`);
  }
  revalidatePath(REKON);
  back(undefined, `#d${date}`);
}

/** "0,7" or "0.7" → 0.7; empty → null. */
const readNumber = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(",", ".").replace("%", "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export async function saveSettings(form: FormData) {
  const supabase = await adminClient();
  const fee = readNumber(form.get("qris_fee_pct"));
  const lag = readNumber(form.get("qris_lag_days"));
  const batas = readRupiah(String(form.get("batas_selisih") ?? ""));
  if (Number.isNaN(fee) || (fee != null && fee > 10)) back("Potongan QRIS: tulis persen, mis. 0,7.");
  if (Number.isNaN(lag) || (lag != null && !Number.isInteger(lag))) back("Jeda QRIS: tulis jumlah hari, mis. 1.");
  if (Number.isNaN(batas) || (batas != null && batas < 0)) back("Batas selisih: tulis angka rupiah, mis. 20.000.");
  const { error } = await supabase.from("bookkeeping_settings").upsert({
    id: 1, qris_fee_pct: fee, qris_lag_days: lag, batas_selisih: batas, updated_at: new Date().toISOString(),
  });
  if (error) back(`Gagal menyimpan: ${error.message}. Sudah jalankan 0014_rekonsiliasi.sql di Supabase?`);
  revalidatePath(REKON);
  back();
}
