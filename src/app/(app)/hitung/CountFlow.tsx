"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatQty, parseQty, type Line } from "@/lib/qty";
import { CATEGORIES, type Item } from "@/lib/types";

type Lines = Record<number, Partial<Line>>;

export function CountFlow(props: {
  sessionId: string; date: string; dateText: string; isToday: boolean; items: Item[]; initialLines: Lines;
}) {
  const { sessionId, items } = props;
  const supabase = useMemo(() => createClient(), []);
  const [lines, setLines] = useState<Lines>(props.initialLines);
  const [cat, setCat] = useState<string>("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState("");
  const [openMasuk, setOpenMasuk] = useState<Set<number>>(() =>
    new Set(Object.entries(props.initialLines).filter(([, l]) => String(l.masuk ?? "").trim()).map(([id]) => Number(id))),
  );
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");

  // One upsert per pause in typing, for all items changed in that pause.
  const pending = useRef<Map<number, Partial<Line>>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  async function flush() {
    const batch = [...pending.current.entries()];
    pending.current.clear();
    if (!batch.length) return;
    const { data: { session: auth } } = await supabase.auth.getSession();
    const rows = batch.map(([item_id, l]) => ({
      session_id: sessionId, item_id, ...l, updated_by: auth?.user.id, updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("opname_lines").upsert(rows, { onConflict: "session_id,item_id" });
    if (error) {
      batch.forEach(([id, l]) => pending.current.set(id, { ...l, ...pending.current.get(id) }));
      setSaveState("error");
      timer.current = setTimeout(flush, 3000);
    } else setSaveState(pending.current.size ? "saving" : "saved");
  }
  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function edit(itemId: number, field: "tersedia" | "masuk", value: string) {
    const next = { ...lines[itemId], [field]: value };
    setLines((prev) => ({ ...prev, [itemId]: next }));
    pending.current.set(itemId, { awal: next.awal ?? null, masuk: next.masuk ?? null, tersedia: next.tersedia ?? null });
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }

  const isDone = (i: Item) => String(lines[i.id]?.tersedia ?? "").trim() !== "";
  const done = items.filter(isDone).length;
  const ql = q.trim().toLowerCase();
  const visible = items.filter(
    (i) => (!cat || i.category === cat) && (!onlyOpen || !isDone(i)) && (!ql || i.name.toLowerCase().includes(ql)),
  );

  return (
    <div className="count">
      <div className="countbar">
        <div className="row">
          <div>
            <p className="eyebrow">Hitung stok · {props.dateText}</p>
            <p className="progress-text"><b>{done}</b> dari {items.length} bahan sudah dihitung</p>
          </div>
          <span className="spacer" />
          <span className={`savestate ${saveState}`}>
            {saveState === "saving" ? "Menyimpan…" : saveState === "saved" ? "Tersimpan" : saveState === "error" ? "Gagal menyimpan, mencoba lagi" : ""}
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={done} aria-valuemax={items.length}>
          <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
        <div className="filters">
          {["", ...CATEGORIES].map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c || "Semua"}</button>
          ))}
          <button className="chip" aria-pressed={onlyOpen} onClick={() => setOnlyOpen(!onlyOpen)}>Belum dihitung</button>
          <input id="search" type="search" placeholder="Cari bahan…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <p className="help">
        Tulis <b>sisa sekarang</b> untuk tiap bahan. Boleh pakai pecahan seperti <code>3 1/2</code> atau <code>3,5</code>.
        Kalau habis, tulis <code>0</code>.
      </p>

      {visible.length === 0 && (
        <p className="empty">{onlyOpen ? "Semua bahan sudah dihitung. 🎉" : "Tidak ada bahan yang cocok."}</p>
      )}

      <ul className="cards">
        {visible.map((i) => {
          const l = lines[i.id] ?? {};
          const kemarin = parseQty(l.awal, i);
          const sisa = parseQty(l.tersedia, i);
          const masuk = parseQty(l.masuk, i);
          const unreadable = Number.isNaN(sisa) || Number.isNaN(masuk);
          const showMasuk = openMasuk.has(i.id);
          return (
            <li key={i.id} className={`card${isDone(i) ? " done" : ""}`}>
              <div className="card-head">
                <div>
                  <b>{i.name}</b>
                  <span className="muted"> · {i.unit || "satuan?"}</span>
                </div>
                <span className="tag">{i.category}</span>
              </div>
              <p className="muted small">
                Kemarin: {l.awal ? (kemarin != null && !Number.isNaN(kemarin) ? `${formatQty(kemarin)} ${i.unit}` : l.awal) : "belum ada data"}
              </p>
              <label className="sisa">
                <span>Sisa sekarang</span>
                <input
                  id={`sisa-${i.id}`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="–"
                  value={String(l.tersedia ?? "")}
                  className={Number.isNaN(sisa) ? "bad" : undefined}
                  onChange={(e) => edit(i.id, "tersedia", e.target.value)}
                />
                <span className="unit">{i.unit}</span>
              </label>
              {showMasuk ? (
                <label className="sisa masuk">
                  <span>Barang masuk hari ini</span>
                  <input
                    id={`masuk-${i.id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="–"
                    value={String(l.masuk ?? "")}
                    className={Number.isNaN(masuk) ? "bad" : undefined}
                    onChange={(e) => edit(i.id, "masuk", e.target.value)}
                  />
                  <span className="unit">{i.unit}</span>
                </label>
              ) : (
                <button className="linkbtn" onClick={() => setOpenMasuk(new Set(openMasuk).add(i.id))}>
                  + Ada barang masuk hari ini?
                </button>
              )}
              {unreadable && (
                <p className="warn small">
                  Angka ini belum bisa dibaca{i.pack_size ? "" : " (isi ukuran kemasan di Bahan untuk gram/ml)"}. Coba tulis
                  angka saja, misalnya 2 atau 1,5.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="donebar">
        <span className="muted">{done < items.length ? `${items.length - done} bahan belum dihitung` : "Semua bahan sudah dihitung"}</span>
        <Link className="btn primary" href={`/pemakaian?date=${props.date}`} onClick={() => { clearTimeout(timer.current); void flush(); }}>
          Selesai, lihat hasil
        </Link>
      </div>
    </div>
  );
}
