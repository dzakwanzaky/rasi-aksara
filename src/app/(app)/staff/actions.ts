"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { normalizeUsername, staffEmail, USERNAME_RULE, validUsername } from "@/lib/staff";

function back(key: "ok" | "err", msg: string): never {
  redirect(`/staff?${key}=${encodeURIComponent(msg)}`);
}

/** The signed-in user's id when they are an admin; otherwise stops with a message. */
async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  // getUser asks Supabase to verify the login, rather than trusting the cookie, because this creates accounts.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) back("err", "Hanya admin yang bisa mengatur staff.");
  if (!adminConfigured()) back("err", "Kunci rahasia Supabase belum dipasang di Vercel.");
  return user.id;
}

export async function addStaff(form: FormData) {
  await requireAdmin();
  const username = normalizeUsername(String(form.get("username") ?? ""));
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!validUsername(username)) back("err", `Username harus ${USERNAME_RULE}.`);
  if (password.length < 6) back("err", "Kata sandi minimal 6 karakter.");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username, name },
  });
  if (error) back("err", /already|registered|exists/i.test(error.message) ? `Username "${username}" sudah dipakai.` : error.message);
  if (form.get("is_admin") && data.user) await admin.from("app_admins").insert({ user_id: data.user.id });
  revalidatePath("/staff");
  back("ok", `Akun "${username}" sudah dibuat. Masuk pakai username dan kata sandinya.`);
}

export async function resetPassword(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const password = String(form.get("password") ?? "");
  if (password.length < 6) back("err", "Kata sandi minimal 6 karakter.");
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
  if (error) back("err", error.message);
  back("ok", "Kata sandi sudah diganti.");
}

/** Blocks or unblocks login. Accounts are never deleted, so the change log keeps who did what. */
export async function setActive(form: FormData) {
  const me = await requireAdmin();
  const id = String(form.get("id"));
  const active = form.get("active") === "1";
  if (id === me && !active) back("err", "Tidak bisa menonaktifkan akun sendiri.");
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  if (error) back("err", error.message);
  revalidatePath("/staff");
  back("ok", active ? "Akun aktif lagi." : "Akun dinonaktifkan. Orang itu tidak bisa masuk lagi.");
}

export async function setAdmin(form: FormData) {
  const me = await requireAdmin();
  const id = String(form.get("id"));
  const make = form.get("admin") === "1";
  if (id === me && !make) back("err", "Tidak bisa mencabut admin dari akun sendiri.");
  const admin = createAdminClient();
  const { error } = make
    ? await admin.from("app_admins").upsert({ user_id: id })
    : await admin.from("app_admins").delete().eq("user_id", id);
  if (error) back("err", error.message);
  revalidatePath("/staff");
  back("ok", make ? "Sekarang admin." : "Bukan admin lagi.");
}
