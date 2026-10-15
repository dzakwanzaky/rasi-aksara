import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatQty } from "@/lib/qty";
import { CATEGORIES, sortItems, type Item } from "@/lib/types";
import { archiveItem, saveItem, setMinStock } from "../actions";
import { isAdmin } from "@/lib/admin";

export default async function Bahan({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit: editParam } = await searchParams;
  const supabase = await createClient();
  // Only admins change items and minimum stock; staff see the list read-only and count in Hitung.
  const admin = await isAdmin(supabase);
  const edit = admin ? editParam : undefined;
  const { data } = await supabase.from("items").select("*").eq("active", true);
  const items = sortItems((data ?? []) as Item[]);
  const editing = edit && edit !== "new" ? items.find((i) => String(i.id) === edit) : undefined;

  return (
    <>
      <div className="bar">
        <h2>Daftar bahan <span className="muted">{items.length}</span></h2>
        <span className="spacer" />
        {admin && !edit && <Link className="btn primary" href="/bahan?edit=new">Tambah bahan</Link>}
      </div>

      {edit && (
        <form action={saveItem} className="panel">
          <h2>{editing ? "Ubah bahan" : "Tambah bahan"}</h2>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="formgrid" style={{ marginTop: 10 }}>
            <label className="f" style={{ gridColumn: "1 / -1" }}>Nama bahan<input id="name" name="name" required defaultValue={editing?.name} /></label>
            <label className="f">Kategori
              <select id="category" name="category" defaultValue={editing?.category ?? "Bar"}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="f">Satuan hitung<input id="unit" name="unit" placeholder="botol, pack, gr, pcs" defaultValue={editing?.unit} /></label>
            <label className="f">Isi per kemasan<input id="pack_size" name="pack_size" inputMode="decimal" placeholder="mis. 1000" defaultValue={editing?.pack_size ?? ""} /></label>
            <label className="f">Satuan isi
              <select id="pack_unit" name="pack_unit" defaultValue={editing?.pack_unit ?? "gr"}><option>gr</option><option>ml</option></select>
            </label>
            <label className="f">Stok minimum<input id="min_stock" name="min_stock" inputMode="decimal" placeholder="mis. 2" defaultValue={editing?.min_stock ?? ""} /></label>
          </div>
          <p className="help">Isi per kemasan dipakai untuk membaca hitungan seperti “5, 329 gr” (5 kemasan + 329 gr sisa).</p>
          <div className="row">
            <button className="btn primary">{editing ? "Simpan" : "Tambah"}</button>
            <Link className="btn" href="/bahan">Batal</Link>
            {editing && (
              <>
                <span className="spacer" />
                <button className="btn danger" formAction={archiveItem}>Hapus dari daftar</button>
              </>
            )}
          </div>
        </form>
      )}

      {admin ? (
        <p className="help">
          <b>Min</b> = batas beli, bukan sisa stok. Kalau sisa di bawah angka ini, bahan masuk ke daftar Belanja.
          Sisa stok dicatat di <Link href="/hitung">Hitung</Link>.
        </p>
      ) : (
        <p className="autosave-note">
          Mau mencatat sisa stok? Pakai tab <Link href="/hitung"><b>Hitung</b></Link>. Halaman ini hanya daftar bahan;
          yang bisa mengubahnya hanya admin.
        </p>
      )}

      {!items.length && <p className="empty">Belum ada bahan. Tekan Tambah bahan untuk mulai.</p>}
      {CATEGORIES.map((c) => {
        const group = items.filter((i) => i.category === c);
        if (!group.length) return null;
        return (
          <div className="group" key={c}>
            <h3>{c} · {group.length}</h3>
            <div className="panel items" style={{ padding: 0, margin: 0 }}>
              {group.map((i) => (
                <div className="it" key={i.id}>
                  <div>
                    <b>{i.name}</b>
                    <br />
                    <small className="muted">
                      {i.unit || "satuan belum diisi"}
                      {i.pack_size ? ` · ${formatQty(i.pack_size)} ${i.pack_unit}/kemasan` : ""}
                      {i.min_stock ? ` · min ${formatQty(i.min_stock)}` : ""}
                    </small>
                  </div>
                  {admin && <div className="row">
                    <form action={setMinStock} className="row minform">
                      <input type="hidden" name="id" value={i.id} />
                      <label className="small muted" htmlFor={`min-${i.id}`}>Min</label>
                      <input id={`min-${i.id}`} name="min_stock" inputMode="decimal" defaultValue={i.min_stock ?? ""} placeholder="–" />
                      <button className="btn small">Simpan</button>
                    </form>
                    <Link className="btn small" href={`/bahan?edit=${i.id}`}>Ubah</Link>
                  </div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
