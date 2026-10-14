import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listSessions } from "@/lib/data";
import { formatQty } from "@/lib/qty";
import { dateLabel, type Item, type LineRow } from "@/lib/types";
import { usageOf } from "@/lib/usage";

/** One item across every count: what was left and how much was used each day. */
export default async function RiwayatBahan({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const supabase = await createClient();
  const [{ data: item }, sessions, { data: lines }] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).maybeSingle(),
    listSessions(supabase),
    supabase.from("opname_lines").select("session_id, item_id, awal, masuk, tersedia").eq("item_id", id),
  ]);
  if (!item) notFound();
  const it = item as Item;
  const byS = new Map(((lines ?? []) as LineRow[]).map((l) => [l.session_id, l]));
  const q = (n: number | null) => (n == null || Number.isNaN(n) ? "–" : `${formatQty(n)} ${it.unit}`.trim());

  return (
    <>
      <Link className="back" href="/riwayat">← Semua riwayat</Link>
      <p className="eyebrow">Riwayat bahan · {it.category}</p>
      <h2 className="big">{it.name} <span className="unit-tag">{it.unit || "satuan?"}</span></h2>
      <ul className="list" style={{ marginTop: 14 }}>
        {sessions.map((s) => {
          const l = byS.get(s.id);
          const u = usageOf(it, l);
          return (
            <li key={s.id} className="use-row">
              <div>
                <Link className="itemlink" href={`/riwayat/${s.count_date}`}><b>{dateLabel(s.count_date)}</b></Link>
                <div className="muted small">
                  {u.status === "notcounted" ? "belum dihitung" : `sisa ${q(u.sisa)}${u.masuk ? ` · masuk ${q(u.masuk)}` : ""}`}
                </div>
              </div>
              <div className="use-val">
                {u.status === "used" && <><span className="use-n">{formatQty(u.used)}</span> <span className="muted small">{it.unit} terpakai</span></>}
                {u.status === "same" && <span className="muted small">tidak terpakai</span>}
                {(u.status === "up" || u.status === "unreadable") && <span className="pill warn">Perlu dicek</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
