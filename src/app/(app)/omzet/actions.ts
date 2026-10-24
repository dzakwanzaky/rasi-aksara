"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { readRupiah } from "@/lib/laporan";
import { accountLabel } from "@/lib/staff";

const REKON = "/omzet/rekonsiliasi";

async function adminClient() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/omzet");
  return supabase;
}

const back = (msg?: string, anchor = ""): never =>
  redirect(`${REKON}${msg ? `?error=${encodeURIComponent(msg)}` : ""}${anchor}`);

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
