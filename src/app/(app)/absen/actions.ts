"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { isAdmin } from "@/lib/admin";
import { accountLabel, loginEmail } from "@/lib/staff";
import { todayJakarta } from "@/lib/data";
import { jakartaTime, parseCoords, type Shift } from "@/lib/absen";

export type Fix = { lat: number; lng: number; accuracy: number };
export type Result = { ok?: string; error?: string };

const MIGRATION_HINT = "Sudah jalankan 0015_absensi.sql di Supabase?";

const friendly = (message: string) =>
  /relation .*attendance|does not exist/.test(message) ? `Tabel absensi belum ada. ${MIGRATION_HINT}`
  : /in_photo|out_photo/.test(message) ? "Fitur selfie belum aktif. Minta admin menjalankan 0016_absen_selfie.sql di Supabase."
  : message;

async function clock(supabase: SupabaseClient, kind: "in" | "out", shift: Shift, fix: Fix, photo: string): Promise<Result> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Belum masuk akun." };
  const name = accountLabel(user.email);
  const today = todayJakarta();
  const { data: open, error: readError } = await supabase.from("attendance").select("id")
    .eq("user_id", user.id).eq("work_date", today).is("clock_out", null).maybeSingle();
  if (readError) return { error: friendly(readError.message) };

  if (kind === "in") {
    if (open) return { error: `${name} sudah clock in hari ini dan belum clock out.` };
    const { error } = await supabase.from("attendance").insert({
      user_id: user.id, username: name, work_date: today, shift, clock_in: new Date().toISOString(),
      in_lat: fix.lat, in_lng: fix.lng, in_accuracy_m: Math.round(fix.accuracy), in_photo: photo,
    });
    if (error) return { error: error.code === "23505" ? `${name} sudah clock in.` : friendly(error.message) };
    return { ok: `${name} berhasil clock in.` };
  }

  if (!open) return { error: `${name} belum clock in hari ini.` };
  const { error } = await supabase.from("attendance").update({
    out_lat: fix.lat, out_lng: fix.lng, out_accuracy_m: Math.round(fix.accuracy), out_photo: photo,
  }).eq("id", open.id);
  if (error) return { error: friendly(error.message) };
  return { ok: `${name} berhasil clock out.` };
}

const goodFix = (f: Fix) => Number.isFinite(f?.lat) && Number.isFinite(f?.lng) && Number.isFinite(f?.accuracy);
const goodPhoto = (p: string) => /^\d{4}-\d{2}-\d{2}\/[\w-]+\.jpg$/.test(p ?? "");

/** Clock in or out as the account signed in on this phone. */
export async function clockSelf(kind: "in" | "out", shift: Shift, fix: Fix, photo: string): Promise<Result> {
  if (!goodFix(fix)) return { error: "Lokasi HP tidak terbaca." };
  if (!goodPhoto(photo)) return { error: "Selfie belum terkirim." };
  const res = await clock(await createClient(), kind, shift, fix, photo);
  revalidatePath("/absen");
  return res;
}

/** Shared phone: clock in or out for another staff member, who proves it is them with their own password.
 * Their sign-in is used only for this one request and does not replace the account on this phone. */
export async function clockOther(
  kind: "in" | "out", shift: Shift, fix: Fix, photo: string, username: string, password: string,
): Promise<Result> {
  if (!goodFix(fix)) return { error: "Lokasi HP tidak terbaca." };
  if (!goodPhoto(photo)) return { error: "Selfie belum terkirim." };
  if (!username.trim() || !password) return { error: "Isi username dan password." };
  const other = createPlainClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await other.auth.signInWithPassword({ email: loginEmail(username), password });
  if (signInError) return { error: "Username atau password salah." };
  const res = await clock(other, kind, shift, fix, photo);
  await other.auth.signOut({ scope: "local" });
  revalidatePath("/absen");
  return res;
}

// ---- Admin ----

const REKAP = "/absen/rekap";

async function adminClient() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/absen");
  return supabase;
}

const back = (date: string, msg?: string): never =>
  redirect(`${REKAP}?date=${date}${msg ? `&error=${encodeURIComponent(msg)}` : ""}`);

/** Opens a short Google Maps link (maps.app.goo.gl) to read the long link it points to. */
async function expandLink(url: string): Promise<string> {
  let current = url;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(current, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0" } });
    const next = res.headers.get("location");
    if (!next) return current;
    current = new URL(next, current).toString();
    if (parseCoords(current)) return current;
  }
  return current;
}

export async function saveLocation(form: FormData) {
  const supabase = await adminClient();
  const date = String(form.get("date") ?? todayJakarta());
  const text = String(form.get("where") ?? "").trim();
  const radius = Number(String(form.get("radius") ?? "").trim() || 100);
  if (!Number.isInteger(radius) || radius < 20 || radius > 2000) back(date, "Radius: tulis meter antara 20 dan 2000, mis. 100.");

  let coords = parseCoords(text);
  if (!coords && /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|maps\.google\.|www\.google\.)/.test(text)) {
    try {
      coords = parseCoords(await expandLink(text));
    } catch {
      coords = null;
    }
  }
  if (!coords) back(date, "Koordinat tidak terbaca dari isian itu. Tempel koordinat seperti -6.2, 106.8 atau pakai tombol lokasi HP.");

  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from("attendance_settings").upsert({
    id: 1, lat: coords!.lat, lng: coords!.lng, radius_m: radius,
    updated_by_name: accountLabel(session?.user.email), updated_at: new Date().toISOString(),
  });
  if (error) back(date, `Gagal menyimpan: ${friendly(error.message)}`);
  revalidatePath(REKAP);
  back(date);
}

/** Fill in or change a clock out by hand, e.g. someone forgot to clock out. */
export async function fixClockOut(form: FormData) {
  const supabase = await adminClient();
  const date = String(form.get("date") ?? "");
  const id = Number(form.get("id"));
  const at = jakartaTime(String(form.get("work_date") ?? ""), String(form.get("time") ?? ""));
  if (!at) back(date, "Jam keluar: tulis seperti 22.30.");
  const { data: row } = await supabase.from("attendance").select("clock_in").eq("id", id).maybeSingle();
  if (row && at! <= new Date(row.clock_in as string).toISOString()) back(date, "Jam keluar harus setelah jam masuk.");
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from("attendance").update({
    clock_out: at, koreksi: `Jam keluar diisi ${accountLabel(session?.user.email)}`,
  }).eq("id", id);
  if (error) back(date, `Gagal menyimpan: ${friendly(error.message)}`);
  revalidatePath(REKAP);
  back(date);
}

export async function deleteAttendance(form: FormData) {
  const supabase = await adminClient();
  const date = String(form.get("date") ?? "");
  const { error } = await supabase.from("attendance").delete().eq("id", Number(form.get("id")));
  if (error) back(date, `Gagal menghapus: ${error.message}`);
  revalidatePath(REKAP);
  back(date);
}
