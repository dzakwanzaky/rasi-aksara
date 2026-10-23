"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { accountLabel } from "@/lib/staff";
import { parseMajoo, readXlsxRows, salesLines, type Menu } from "@/lib/sales";
import { summarize } from "@/lib/omzet";

async function adminClient() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/penjualan");
  return supabase;
}

/** Where an upload comes back to: the Omzet tab or the Penjualan tab, whichever had the form. */
const home = (form: FormData) => (form.get("from") === "omzet" ? "/omzet" : "/penjualan");

/** Saves a Majoo "Detail Penjualan" export. Each day in the file replaces what was uploaded for that day before. */
export async function uploadSales(form: FormData) {
  const supabase = await adminClient();
  const fail = (msg: string): never => redirect(`${home(form)}?error=${encodeURIComponent(msg)}`);
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) fail("Pilih file Excel dari Majoo dulu.");
  let trx;
  try {
    trx = parseMajoo(readXlsxRows(new Uint8Array(await (file as File).arrayBuffer())));
  } catch (e) {
    fail(e instanceof Error ? e.message : "File tidak bisa dibaca.");
  }
  if (!trx!.length) fail("Tidak ada transaksi di file ini.");

  const { data: menuRows } = await supabase.from("menus").select("id, name, price");
  const menus = (menuRows ?? []) as Menu[];
  const known = new Map(menus.map((m) => [m.name.trim().toLowerCase(), m]));
  // New menus go on the Resep page so their recipe and price can be filled in.
  const fresh = [...new Set(trx!.flatMap((t) => t.products))].filter((p) => !known.has(p.trim().toLowerCase()));
  if (fresh.length) await supabase.from("menus").upsert(fresh.map((name) => ({ name })), { onConflict: "name", ignoreDuplicates: true });
  const price = (m: string) => known.get(m.trim().toLowerCase())?.price;

  const { data: { session } } = await supabase.auth.getSession();
  const days = [...new Set(trx!.map((t) => t.date))].sort();
  for (const day of days) {
    const ofDay = trx!.filter((t) => t.date === day);
    const rows = ofDay.map((t) => ({ sale_date: day, trx_no: t.no, shift: t.shift, method: t.method, order_type: t.orderType, products: t.products, total: t.total }));
    const sum = summarize(rows);
    const { error } = await supabase.from("sales_days").upsert({
      sale_date: day,
      file_name: (file as File).name,
      trx_count: ofDay.length,
      total: sum.total,
      ...sum.byMethod,
      uploaded_by_name: accountLabel(session?.user.email),
      uploaded_at: new Date().toISOString(),
    });
    if (error) fail(`Gagal menyimpan: ${error.message}. Sudah jalankan 0012 dan 0013 di Supabase?`);
    await supabase.from("sales_lines").delete().eq("sale_date", day);
    const lines = salesLines(ofDay, price).map((l) => ({ sale_date: day, menu: l.menu, shift: l.shift, qty: l.qty, guessed: l.guessed }));
    const { error: e2 } = await supabase.from("sales_lines").insert(lines);
    if (e2) fail(`Gagal menyimpan: ${e2.message}`);
    await supabase.from("sales_trx").delete().eq("sale_date", day);
    const { error: e3 } = await supabase.from("sales_trx").insert(rows);
    if (e3) fail(`Gagal menyimpan transaksi: ${e3.message}. Sudah jalankan 0013_omzet.sql di Supabase?`);
  }
  revalidatePath("/penjualan");
  revalidatePath("/omzet");
  redirect(days.length === 1 ? `${home(form)}/${days[0]}` : home(form));
}

export async function deleteSalesDay(form: FormData) {
  const supabase = await adminClient();
  await supabase.from("sales_days").delete().eq("sale_date", String(form.get("date")));
  revalidatePath("/penjualan");
  revalidatePath("/omzet");
  redirect(home(form));
}

const back = (menuId: FormDataEntryValue | null) => redirect(`/penjualan/resep${menuId ? `?menu=${menuId}#m${menuId}` : ""}`);

export async function saveMenu(form: FormData) {
  const supabase = await adminClient();
  const name = String(form.get("name") ?? "").trim();
  const p = String(form.get("price") ?? "").replace(/\D/g, "");
  const data = { ...(name ? { name } : {}), price: p ? Number(p) : null };
  const id = form.get("id");
  if (id) await supabase.from("menus").update(data).eq("id", Number(id));
  else if (name) await supabase.from("menus").upsert(data, { onConflict: "name" });
  revalidatePath("/penjualan", "layout");
  back(id);
}

export async function deleteMenu(form: FormData) {
  const supabase = await adminClient();
  await supabase.from("menus").delete().eq("id", Number(form.get("id")));
  revalidatePath("/penjualan", "layout");
  back(null);
}

export async function saveRecipeLine(form: FormData) {
  const supabase = await adminClient();
  const menu_id = Number(form.get("menu_id"));
  const item_id = Number(form.get("item_id"));
  const qty = String(form.get("qty") ?? "").trim();
  if (menu_id && item_id) {
    if (qty) await supabase.from("recipe_lines").upsert({ menu_id, item_id, qty });
    else await supabase.from("recipe_lines").delete().eq("menu_id", menu_id).eq("item_id", item_id);
  }
  revalidatePath("/penjualan", "layout");
  back(form.get("menu_id"));
}
