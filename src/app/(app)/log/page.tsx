import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateLabel } from "@/lib/types";
import { UserPick } from "./UserPick";

type Entry = {
  id: number;
  at: string;
  user_email: string | null;
  table_name: "items" | "opname_sessions" | "opname_lines";
  action: "INSERT" | "UPDATE" | "DELETE";
  row_key: string;
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
};

const TZ = "Asia/Jakarta";
const day = (at: string) => new Date(at).toLocaleDateString("en-CA", { timeZone: TZ });
const time = (at: string) => new Date(at).toLocaleTimeString("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const who = (email: string | null) => (email ? email.split("@")[0] : "Admin (Supabase)");
const v = (x: unknown) => (x == null || x === "" ? "kosong" : String(x));

const LINE_FIELDS: Record<string, string> = { tersedia: "sisa", masuk: "barang masuk", awal: "stok kemarin" };
const ITEM_FIELDS: Record<string, string> = {
  name: "nama", category: "kategori", unit: "satuan", min_stock: "min stok", pack_size: "ukuran kemasan", pack_unit: "satuan kemasan",
};

function changes(e: Entry, fields: Record<string, string>) {
  return Object.entries(fields)
    .filter(([k]) => (e.old?.[k] ?? null) !== (e.new?.[k] ?? null))
    .map(([k, label]) => (e.action === "UPDATE" ? `${label} ${v(e.old?.[k])} → ${v(e.new?.[k])}` : `${label} ${v(e.new?.[k])}`));
}

function describe(e: Entry, itemName: (id: number) => string, sessionDate: (id: string) => string) {
  const row = e.new ?? e.old ?? {};
  if (e.table_name === "opname_lines") {
    const what = `${itemName(Number(row.item_id))} (hitungan ${sessionDate(String(row.session_id))})`;
    if (e.action === "DELETE") return `Menghapus angka ${what}`;
    const filled = Object.keys(LINE_FIELDS).some((k) => e.old?.[k] != null && e.old?.[k] !== "" && e.old?.[k] !== e.new?.[k]);
    return `${filled ? "Mengubah" : "Mengisi"} ${what}: ${changes(e, LINE_FIELDS).join(", ")}`;
  }
  if (e.table_name === "opname_sessions") {
    const date = row.count_date ? dateLabel(String(row.count_date)) : "?";
    if (e.action === "INSERT") return `Memulai hitungan ${date}`;
    if (e.action === "DELETE") return `Menghapus hitungan ${date} (${(e.old?.lines as unknown[] | undefined)?.length ?? 0} bahan)`;
    return `Mengubah hitungan ${date}`;
  }
  const name = String(row.name ?? "?");
  if (e.action === "INSERT") return `Menambah bahan ${name}`;
  if (e.action === "DELETE") return `Menghapus bahan ${name}`;
  if (e.old?.active === true && e.new?.active === false) return `Mengarsipkan bahan ${name}`;
  if (e.old?.active === false && e.new?.active === true) return `Mengaktifkan lagi bahan ${name}`;
  return `Mengubah bahan ${name}: ${changes(e, ITEM_FIELDS).join(", ")}`;
}

export default async function Log({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const { user } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(300);
  if (user) q = user === "admin" ? q.is("user_email", null) : q.eq("user_email", user);
  const [{ data: log, error }, { data: items }, { data: sessions }, { data: people }] = await Promise.all([
    q,
    supabase.from("items").select("id, name"),
    supabase.from("opname_sessions").select("id, count_date"),
    supabase.from("audit_log").select("user_email").order("at", { ascending: false }).limit(1000),
  ]);

  if (error) {
    return <p className="empty">Catatan perubahan belum aktif. Jalankan file 0004_audit_log.sql di Supabase dulu.</p>;
  }
  const entries = (log ?? []) as Entry[];
  const names = new Map((items ?? []).map((i) => [i.id as number, i.name as string]));
  const dates = new Map((sessions ?? []).map((s) => [s.id as string, s.count_date as string]));
  for (const e of entries)
    if (e.table_name === "opname_sessions") {
      const r = e.new ?? e.old;
      if (r?.count_date) dates.set(String(r.id), String(r.count_date));
    }
  const itemName = (id: number) => names.get(id) ?? `bahan #${id}`;
  const sessionDate = (id: string) => (dates.get(id) ? dateLabel(dates.get(id)!) : "yang sudah dihapus");
  const users = [...new Set((people ?? []).map((p) => (p.user_email as string | null) ?? "admin"))];

  const byDay = new Map<string, Entry[]>();
  for (const e of entries) byDay.set(day(e.at), [...(byDay.get(day(e.at)) ?? []), e]);

  return (
    <>
      <div className="bar">
        <div>
          <p className="eyebrow">Catatan perubahan</p>
          <h2 className="big">Siapa mengubah apa</h2>
        </div>
        <span className="spacer" />
        <UserPick users={users} current={user ?? ""} />
      </div>
      <p className="help">Semua perubahan tercatat otomatis dan tidak bisa dihapus dari aplikasi.</p>

      {!entries.length && <p className="empty">Belum ada perubahan tercatat{user ? " untuk orang ini" : ""}.</p>}
      {[...byDay].map(([d, list]) => (
        <section className="group" key={d}>
          <h3>{dateLabel(d)}</h3>
          <ul className="list">
            {list.map((e) => (
              <li key={e.id} className="log-row">
                <span className="log-time">{time(e.at)}</span>
                <div>
                  <b>{who(e.user_email)}</b>
                  <div className="small">{describe(e, itemName, sessionDate)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {entries.length === 300 && <p className="muted small">Menampilkan 300 perubahan terakhir.</p>}
      {user && <p><Link href="/log">Lihat semua orang</Link></p>}
    </>
  );
}
