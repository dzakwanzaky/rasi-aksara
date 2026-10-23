import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { rupiah } from "@/lib/laporan";
import { formatQty } from "@/lib/qty";
import { recipeQty, type Menu, type RecipeLine } from "@/lib/sales";
import { sortItems, type Item } from "@/lib/types";
import { deleteMenu, saveMenu, saveRecipeLine } from "../actions";

export const dynamic = "force-dynamic";

export default async function Resep({ searchParams }: { searchParams: Promise<{ menu?: string }> }) {
  const { menu: openId } = await searchParams;
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    return (
      <section className="panel">
        <h2>Resep</h2>
        <p className="muted">Halaman ini hanya untuk pemilik/admin.</p>
      </section>
    );
  }
  const [{ data: menuRows }, { data: recipe }, { data: itemRows }] = await Promise.all([
    supabase.from("menus").select("id, name, price").order("name"),
    supabase.from("recipe_lines").select("menu_id, item_id, qty"),
    supabase.from("items").select("*"),
  ]);
  const all = sortItems((itemRows ?? []) as Item[]);
  const items = all.filter((i) => i.active);
  const itemById = new Map(all.map((i) => [i.id, i]));
  const lines = (recipe ?? []) as RecipeLine[];
  const menus = ((menuRows ?? []) as Menu[]).map((m) => ({ ...m, lines: lines.filter((l) => l.menu_id === m.id && itemById.has(l.item_id)) }));
  // Menus still missing a recipe or a price come first.
  menus.sort((a, b) => Number(a.lines.length > 0 && a.price != null) - Number(b.lines.length > 0 && b.price != null) || a.name.localeCompare(b.name));
  const todo = menus.filter((m) => !m.lines.length || m.price == null).length;

  return (
    <>
      <Link className="back" href="/penjualan">← Penjualan</Link>
      <p className="eyebrow">Resep per porsi</p>
      <h2 className="big">Resep menu</h2>
      <p className="help">
        Nama menu harus sama dengan di Majoo. Harga dipakai untuk menebak jumlah porsi per transaksi.
        Tulis jumlah bahan seperti di stok opname: <b>100 gr</b>, <b>30 ml</b>, <b>1</b>, <b>1/2</b>. Gram untuk bahan
        yang dihitung per bungkus/potong butuh &quot;isi per kemasan&quot; di <Link href="/bahan">Bahan</Link>.
        Kosongkan jumlah lalu Simpan untuk menghapus bahan dari resep.
      </p>
      {todo > 0 && <p className="notice">{todo} menu belum lengkap (resep atau harga kosong), ada di paling atas.</p>}

      <form action={saveMenu} className="panel row">
        <label className="f" style={{ flex: "2 1 180px" }}>Menu baru (nama di Majoo)<input name="name" required /></label>
        <label className="f" style={{ flex: "1 1 100px" }}>Harga<input name="price" inputMode="numeric" placeholder="18000" /></label>
        <button className="btn">Tambah menu</button>
      </form>

      <div className="group">
        {menus.map((m) => (
          <details key={m.id} id={`m${m.id}`} className="panel" open={openId === String(m.id)}>
            <summary className="row">
              <b>{m.name}</b>
              <span className="muted small">{m.price != null ? rupiah(m.price) : "harga kosong"} · {m.lines.length ? `${m.lines.length} bahan` : "resep kosong"}</span>
              {(!m.lines.length || m.price == null) && <span className="pill warn">Belum lengkap</span>}
            </summary>

            <form action={saveMenu} className="row" style={{ marginBlock: 10 }}>
              <input type="hidden" name="id" value={m.id} />
              <label className="f" style={{ flex: "2 1 160px" }}>Nama<input name="name" defaultValue={m.name} /></label>
              <label className="f" style={{ flex: "1 1 90px" }}>Harga<input name="price" inputMode="numeric" defaultValue={m.price ?? ""} /></label>
              <button className="btn small">Simpan</button>
            </form>

            <ul className="list">
              {m.lines.map((l) => {
                const item = itemById.get(l.item_id)!;
                const per = recipeQty(l.qty, item);
                return (
                  <li key={l.item_id} className="list-row">
                    <div>
                      <b>{item.name}</b>{!item.active && <span className="muted small"> · tidak ada di stok opname</span>}
                      <div className="muted small">
                        {per == null || Number.isNaN(per)
                          ? <span className="error">belum bisa dihitung dalam {item.unit || "satuan bahan"}</span>
                          : `= ${formatQty(per)} ${item.unit} per porsi`}
                      </div>
                    </div>
                    <form action={saveRecipeLine} className="row minform">
                      <input type="hidden" name="menu_id" value={m.id} />
                      <input type="hidden" name="item_id" value={l.item_id} />
                      <input name="qty" defaultValue={l.qty} aria-label={`Jumlah ${item.name}`} style={{ width: 96 }} />
                      <button className="btn small">Simpan</button>
                    </form>
                  </li>
                );
              })}
            </ul>

            <form action={saveRecipeLine} className="row" style={{ marginTop: 10 }}>
              <input type="hidden" name="menu_id" value={m.id} />
              <label className="f" style={{ flex: "2 1 160px" }}>Tambah bahan
                <select name="item_id" required defaultValue="">
                  <option value="" disabled>Pilih bahan</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit || "–"})</option>)}
                </select>
              </label>
              <label className="f" style={{ flex: "1 1 90px" }}>Jumlah<input name="qty" required placeholder="100 gr" /></label>
              <button className="btn small">Tambah</button>
            </form>
            <details style={{ marginTop: 10 }}>
              <summary className="muted small">Hapus menu ini</summary>
              <form action={deleteMenu} className="row">
                <input type="hidden" name="id" value={m.id} />
                <span className="small">Menu dan resepnya akan dihapus.</span>
                <button className="btn danger small">Ya, hapus</button>
              </form>
            </details>
          </details>
        ))}
      </div>
    </>
  );
}
