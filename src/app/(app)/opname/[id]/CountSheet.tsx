"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { calcLine, formatQty, type Line } from "@/lib/qty";
import { CATEGORIES, dateLabel, type Item, type LineRow, type Session } from "@/lib/types";
import { deleteSession } from "../../actions";

type Field = keyof Line;
const FIELDS: Field[] = ["awal", "masuk", "tersedia"];

export function CountSheet({ session, items, initialLines }: { session: Session; items: Item[]; initialLines: LineRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [lines, setLines] = useState<Record<number, Partial<Line>>>(() =>
    Object.fromEntries(initialLines.map((l) => [l.item_id, { awal: l.awal, masuk: l.masuk, tersedia: l.tersedia }])),
  );
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Coalesce keystrokes: one upsert per item after a short pause.
  const pending = useRef<Map<number, Partial<Line>>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function flush() {
    const batch = [...pending.current.entries()];
    pending.current.clear();
    if (!batch.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    const rows = batch.map(([item_id, l]) => ({
      session_id: session.id, item_id, ...l, updated_by: user?.id, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("opname_lines").upsert(rows, { onConflict: "session_id,item_id" });
    if (error) {
      batch.forEach(([id, l]) => pending.current.set(id, { ...l, ...pending.current.get(id) }));
      setSaveState("gagal menyimpan, mencoba lagi…");
      timer.current = setTimeout(flush, 3000);
    } else setSaveState(pending.current.size ? "menyimpan…" : "tersimpan");
  }

  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function edit(itemId: number, field: Field, value: string) {
    const next = { ...lines[itemId], [field]: value };
    setLines((prev) => ({ ...prev, [itemId]: next }));
    pending.current.set(itemId, { awal: next.awal ?? null, masuk: next.masuk ?? null, tersedia: next.tersedia ?? null });
    setSaveState("menyimpan…");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }

  const results = useMemo(() => new Map(items.map((i) => [i.id, calcLine(lines[i.id], i)])), [items, lines]);
  const done = [...results.values()].filter((r) => r.tersedia != null && !Number.isNaN(r.tersedia)).length;
  const low = [...results.values()].filter((r) => r.flags.some((f) => f.level === "warn")).length;
  const bad = [...results.values()].filter((r) => r.flags.some((f) => f.level === "bad")).length;

  const ql = q.toLowerCase();
  const visible = items.filter(
    (i) =>
      (!cat || i.category === cat) &&
      (!ql || i.name.toLowerCase().includes(ql)) &&
      (!onlyOpen || !String(lines[i.id]?.tersedia ?? "").trim()),
  );

  return (
    <>
      <div className="bar">
        <h2>{dateLabel(session.count_date)}</h2>
        <span className="muted">{saveState}</span>
        <span className="spacer" />
        <a className="btn" href={`/opname/${session.id}/csv`}>Unduh CSV</a>
        <Link className="btn" href="/opname">Semua opname</Link>
      </div>
      {session.note && <p className="help">{session.note}</p>}
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="chip">Dihitung <b>{done}/{items.length}</b></span>
        {low > 0 && <span className="chip">Habis / menipis <b>{low}</b></span>}
        {bad > 0 && <span className="chip">Perlu dicek <b>{bad}</b></span>}
      </div>
      <div className="filters">
        <input id="search" type="search" placeholder="Cari bahan…" value={q} onChange={(e) => setQ(e.target.value)} />
        {["", ...CATEGORIES].map((c) => (
          <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c || "Semua"}</button>
        ))}
        <button className="chip" aria-pressed={onlyOpen} onClick={() => setOnlyOpen(!onlyOpen)}>Belum dihitung</button>
      </div>

      <div className="colhead"><span>Bahan</span><span>Awal</span><span>Masuk</span><span>Tersedia</span><span>Keluar</span></div>
      {CATEGORIES.map((c) => {
        const group = visible.filter((i) => i.category === c);
        if (!group.length) return null;
        return (
          <div className="group" key={c}>
            <h3>{c} · {group.length}</h3>
            {group.map((i) => {
              const r = results.get(i.id)!;
              return (
                <div className="line" key={i.id}>
                  <div className="nm">
                    <b>{i.name}</b>
                    <small>
                      {i.unit || "satuan?"}
                      {i.pack_size ? ` · ${formatQty(i.pack_size)} ${i.pack_unit}/kemasan` : ""}
                    </small>
                  </div>
                  {FIELDS.map((f) => {
                    const raw = String(lines[i.id]?.[f] ?? "");
                    const val = r[f];
                    const shown = Number.isNaN(val) ? "?" : raw.trim() && val != null && formatQty(val) !== raw.trim() ? "= " + formatQty(val) : "";
                    return (
                      <div className="qty" key={f}>
                        <span className="lb">{f}</span>
                        <input
                          id={`q-${i.id}-${f}`}
                          className={Number.isNaN(val) ? "bad" : undefined}
                          value={raw}
                          autoComplete="off"
                          aria-label={`${f} ${i.name}`}
                          onChange={(e) => edit(i.id, f, e.target.value)}
                        />
                        <span className="pv">{shown}</span>
                      </div>
                    );
                  })}
                  <div className="out">
                    <div>
                      <div>{r.keluar == null ? "—" : formatQty(r.keluar)}</div>
                      {r.flags.map((fl) => <span key={fl.label} className={`flag ${fl.level}`}>{fl.label}</span>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {!visible.length && <p className="empty">Tidak ada bahan yang cocok.</p>}

      <div className="panel" style={{ marginTop: 32 }}>
        {!confirmDelete ? (
          <button className="btn danger small" onClick={() => setConfirmDelete(true)}>Hapus opname ini</button>
        ) : (
          <form action={deleteSession} className="row">
            <input type="hidden" name="id" value={session.id} />
            <span>Hapus opname {dateLabel(session.count_date)} beserta semua angkanya?</span>
            <button className="btn danger small">Ya, hapus</button>
            <button type="button" className="btn small" onClick={() => setConfirmDelete(false)}>Batal</button>
          </form>
        )}
      </div>
    </>
  );
}
