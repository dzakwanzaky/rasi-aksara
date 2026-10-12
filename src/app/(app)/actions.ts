"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Category } from "@/lib/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Starts a count; Awal is carried over from the latest count's Tersedia. */
export async function createSession(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const countDate = String(form.get("count_date") || new Date().toISOString().slice(0, 10));
  const note = String(form.get("note") ?? "").trim();

  const { data: prev } = await supabase
    .from("opname_sessions")
    .select("id")
    .order("count_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: session, error } = await supabase
    .from("opname_sessions")
    .insert({ count_date: countDate, note, created_by: user?.id })
    .select("id")
    .single();
  if (error) throw new Error("Gagal membuat opname: " + error.message);

  if (prev) {
    const { data: lines } = await supabase
      .from("opname_lines")
      .select("item_id, tersedia")
      .eq("session_id", prev.id)
      .not("tersedia", "is", null);
    const carried = (lines ?? [])
      .filter((l) => String(l.tersedia).trim() !== "")
      .map((l) => ({ session_id: session.id, item_id: l.item_id, awal: l.tersedia, updated_by: user?.id }));
    if (carried.length) await supabase.from("opname_lines").insert(carried);
  }

  revalidatePath("/opname");
  redirect(`/opname/${session.id}`);
}

export async function deleteSession(form: FormData) {
  const supabase = await createClient();
  await supabase.from("opname_sessions").delete().eq("id", String(form.get("id")));
  revalidatePath("/opname");
  revalidatePath("/riwayat");
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
