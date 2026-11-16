"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readXlsxRows } from "@/lib/sales";
import { accountLabel } from "@/lib/staff";
import { listAccounts } from "@/lib/jadwal-server";
import { daysInMonth, matchAccount, monthDate, parseSchedule, type Account, type Jadwal } from "@/lib/jadwal";

async function admin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Silakan masuk lagi.");
  const { data } = await supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) throw new Error("Hanya admin yang bisa mengubah jadwal.");
  return { supabase, by: accountLabel(user.email) };
}

export type PreviewPerson = { name: string; shifts: (Jadwal | null)[]; username: string | null; sure: boolean };
export type Preview =
  | { error: string }
  | { month: string | null; days: number; people: PreviewPerson[]; warnings: string[]; accounts: Account[]; existing: number };

/** Reads the uploaded Excel and returns what would be saved. Nothing is written yet. */
export async function previewUpload(_prev: Preview | null, form: FormData): Promise<Preview> {
  try {
    const { supabase } = await admin();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Pilih file Excel dulu." };
    let rows: string[][];
    try {
      rows = readXlsxRows(new Uint8Array(await file.arrayBuffer()));
    } catch {
      return { error: "File tidak terbaca. Pakai file .xlsx (simpan ulang dari Excel / Google Sheets sebagai .xlsx)." };
    }
    const fallback = String(form.get("month") ?? "");
    const p = parseSchedule(rows, /^\d{4}-\d{2}$/.test(fallback) ? fallback : undefined);
    const accounts = await listAccounts();
    const people = p.people.map((x) => {
      const m = matchAccount(x.name, accounts);
      return { ...x, username: m?.username ?? null, sure: m?.sure ?? false };
    });
    let existing = 0;
    if (p.month) {
      const { count } = await supabase.from("shift_schedule").select("name", { count: "exact", head: true })
        .gte("work_date", monthDate(p.month, 1)).lte("work_date", monthDate(p.month, daysInMonth(p.month)));
      existing = count ?? 0;
    }
    return { month: p.month, days: p.days, people, warnings: p.warnings, accounts, existing };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Replaces the whole month with the previewed sheet. */
export async function saveSchedule(month: string, people: { name: string; username: string | null; shifts: (Jadwal | null)[] }[]) {
  const { supabase, by } = await admin();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Bulan tidak valid.");
  const last = daysInMonth(month);
  const rows = people.flatMap((p) =>
    p.shifts.slice(0, last).flatMap((shift, i) =>
      shift ? [{ work_date: monthDate(month, i + 1), name: p.name.trim(), username: p.username || null, shift, updated_by_name: by }] : []));
  if (!rows.length) throw new Error("Tidak ada jadwal untuk disimpan.");
  const del = await supabase.from("shift_schedule").delete().gte("work_date", monthDate(month, 1)).lte("work_date", monthDate(month, last));
  if (del.error) throw new Error(del.error.message);
  const ins = await supabase.from("shift_schedule").insert(rows);
  if (ins.error) throw new Error(ins.error.message);
  revalidatePath("/jadwal", "layout");
  return rows.length;
}

/** One cell changed by tapping it in the month grid. `shift` null clears the day. */
export async function setCell(date: string, name: string, username: string | null, shift: Jadwal | null) {
  const { supabase, by } = await admin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Tanggal tidak valid.");
  const res = shift
    ? await supabase.from("shift_schedule").upsert({ work_date: date, name, username, shift, updated_by_name: by, updated_at: new Date().toISOString() })
    : await supabase.from("shift_schedule").delete().eq("work_date", date).eq("name", name);
  if (res.error) throw new Error(res.error.message);
  revalidatePath("/jadwal", "layout");
}

/** Links a name in the schedule to a staff login, for every day it appears. */
export async function linkName(form: FormData) {
  const { supabase } = await admin();
  const name = String(form.get("name") ?? "");
  const username = String(form.get("username") ?? "") || null;
  const { error } = await supabase.from("shift_schedule").update({ username }).eq("name", name);
  if (error) throw new Error(error.message);
  revalidatePath("/jadwal", "layout");
}
