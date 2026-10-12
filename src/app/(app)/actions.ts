"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Category } from "@/lib/types";
import { todayJakarta } from "@/lib/data";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Opens the count for a date (today by default), creating it if needed.
 * Each item's starting stock is carried over from the latest earlier count's "sisa". */
export async function startCount(form: FormData) {
  const supabase = await createClient();
  const { data: { session: auth } } = await supabase.auth.getSession();
  const countDate = String(form.get("count_date") || todayJakarta());

  const { data: existing } = await supabase
    .from("opname_sessions").select("id").eq("count_date", countDate).limit(1).maybeSingle();
  if (existing) redirect(`/hitung?date=${countDate}`);

  const { data: prev } = await supabase
    .from("opname_sessions").select("id")
    .lt("count_date", countDate)
    .order("count_date", { ascending: false }).order("created_at", { ascending: false })
    .limit(1).maybeSingle();

  const { data: created, error } = await supabase
    .from("opname_sessions")
    .insert({ count_date: countDate, created_by: auth?.user.id })
    .select("id").single();
  if (error) throw new Error("Gagal membuat hitungan: " + error.message);

  if (prev) {
    const { data: lines } = await supabase
      .from("opname_lines").select("item_id, tersedia")
      .eq("session_id", prev.id).not("tersedia", "is", null);
    const carried = (lines ?? [])
      .filter((l) => String(l.tersedia).trim() !== "")
      .map((l) => ({ session_id: created.id, item_id: l.item_id, awal: l.tersedia, updated_by: auth?.user.id }));
    if (carried.length) await supabase.from("opname_lines").insert(carried);
  }

  revalidatePath("/hitung");
  redirect(`/hitung?date=${countDate}`);
}

export async function deleteSession(form: FormData) {
  const supabase = await createClient();
  await supabase.from("opname_sessions").delete().eq("id", String(form.get("id")));
  revalidatePath("/pemakaian");
  redirect("/pemakaian");
}

const numOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(",", ".");
  return s && !Number.isNaN(Number(s)) ? Number(s) : null;
};

export async function saveItem(form: FormData) {
  const supabase = await createClient();
  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category")) as Category;
  if (!name || !CATEGORIES.includes(category)) return;
  const data = {
    name,
    category,
    unit: String(form.get("unit") ?? "").trim(),
    pack_size: numOrNull(form.get("pack_size")),
    pack_unit: form.get("pack_unit") === "ml" ? "ml" : "gr",
    min_stock: numOrNull(form.get("min_stock")),
  };
  const id = form.get("id");
  if (id) {
    await supabase.from("items").update(data).eq("id", Number(id));
  } else {
    const { data: last } = await supabase
      .from("items").select("sort_order").eq("category", category)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    await supabase.from("items").insert({ ...data, sort_order: (last?.sort_order ?? 0) + 1 });
  }
  revalidatePath("/bahan");
  redirect("/bahan");
}

/** Hides an item from new counts; its history stays. */
export async function archiveItem(form: FormData) {
  const supabase = await createClient();
  await supabase.from("items").update({ active: false }).eq("id", Number(form.get("id")));
  revalidatePath("/bahan");
  redirect("/bahan");
}

/** Quick edit of an item's minimum stock from the item list. */
export async function setMinStock(form: FormData) {
  const supabase = await createClient();
  await supabase.from("items").update({ min_stock: numOrNull(form.get("min_stock")) }).eq("id", Number(form.get("id")));
  revalidatePath("/bahan");
  revalidatePath("/belanja");
}
